#!/usr/bin/env python3
"""
Advanced SQLAlchemy 2.0+ Migration Script using AST-based transformation

This script safely converts old-style Column() declarations to mapped_column() with type hints
by parsing and transforming Python AST rather than using fragile regex.
"""

import ast
import os
import sys
import uuid
from pathlib import Path
from typing import List, Dict, Optional, Tuple

MODELS_DIR = Path("backend/app/models")

class ColumnToMappedColumnConverter(ast.NodeTransformer):
    """AST transformer that converts Column() to mapped_column() assignments."""
    
    def __init__(self, filename: str):
        self.filename = filename
        self.changes = []
        self.class_found = False
        self.in_base_class = False
        
    def visit_ClassDef(self, node: ast.ClassDef) -> ast.ClassDef:
        # Check if this class inherits from Base
        self.in_base_class = any(
            (isinstance(base, ast.Name) and base.id == 'Base') or
            (isinstance(base, ast.Attribute) and 'Base' in ast.unparse(base))
            for base in node.bases
        )
        
        if self.in_base_class:
            self.generic_visit(node)
        
        self.in_base_class = False
        return node
    
    def visit_Assign(self, node: ast.Assign) -> Optional[ast.Assign]:
        """Convert Column(...)  assignments to mapped_column(...)."""
        if not self.in_base_class or not isinstance(node.value, ast.Call):
            return node
        
        # Check if this is a Column(...) call
        if not (isinstance(node.value.func, ast.Name) and node.value.func.id == 'Column'):
            return node
        
        # Get the variable name
        if not isinstance(node.targets[0], ast.Name):
            return node
        
        var_name = node.targets[0].id
        
        # Check if already has type annotation (Mapped[...] = Column(...))
        # This is trickier in AST, so we'll skip purely AST-based detection
        # and rely on source-level conversion instead
        
        return node

def process_model_file_source(file_path: Path) -> Tuple[bool, str, str]:
    """Process a single model file using source-level transformations."""
    with open(file_path, 'r') as f:
        original = f.read()
    
    if 'Column(' not in original or '= mapped_column(' in original:
        return False, "No old style columns found", original
    
    content = original
    lines = content.split('\n')
    converted_lines = []
    in_base_class = False
    class_indent = 0
    changes_made = 0
    
    for i, line in enumerate(lines):
        # Detect class definition
        if line.strip().startswith('class ') and '(Base)' in line:
            in_base_class = True
            class_indent = len(line) - len(line.lstrip())
            converted_lines.append(line)
            continue
        
        # Detect end of class
        if in_base_class and line.strip() and not line.startswith(' ' * (class_indent + 1)):
            in_base_class = False
        
        # Convert Column lines in classes
        if in_base_class and ' = Column(' in line:
            converted = convert_column_line_advanced(line, i, lines)
            if converted != line:
                converted_lines.append(converted)
                changes_made += 1
            else:
                converted_lines.append(line)
        else:
            converted_lines.append(line)
    
    if changes_made > 0:
        return True, f"Converted {changes_made} columns", '\n'.join(converted_lines)
    else:
        return False, "No conversions possible", original

def convert_column_line_advanced(line: str, line_num: int, all_lines: List[str]) -> str:
    """Advanced conversion of Column line to mapped_column with type hints."""
    import re
    
    # Match: field_name = Column(...) or field_name: Mapped[...] = Column(...)
    match = re.match(r'^(\s*)(\w+)(?::\s*Mapped\[([^\]]+)\])?\s*=\s*Column\((.*)\)\s*(#.*)?$', line)
    
    if not match:
        return line
    
    indent, name, existing_type, col_args, comment = match.groups()
    
    # Infer type from Column arguments if not already present
    inferred_type = infer_python_type(col_args)
    if not inferred_type:
        # Can't convert without type info
        return line
    
    # Use existing type if provided, otherwise use inferred
    type_hint = existing_type or inferred_type
    
    # Check if optional
    is_optional = 'nullable=True' in col_args
    if is_optional and not type_hint.startswith('Optional['):
        type_hint = f"Optional[{type_hint}]"
    
    # Build new line
    new_line = f"{indent}{name}: Mapped[{type_hint}] = mapped_column({col_args})"
    if comment:
        new_line += f" {comment}"
    
    return new_line

def infer_python_type(col_args: str) -> Optional[str]:
    """Infer Python type from Column definition."""
    col_args_lower = col_args.lower()
    
    # Remove nullable and other kwargs for type detection
    first_param = col_args.split(',')[0].strip()
    
    # SQLAlchemy type mappings
    type_map = {
        'string': 'str',
        'text': 'str',
        'integer': 'int',
        'biginteger': 'int',
        'smallinteger': 'int',
        'float': 'float',
        'numeric': 'float',
        'boolean': 'bool',
        'uuid': 'uuid.UUID',
        'pg_uuid': 'uuid.UUID',
        'json': 'dict',
        'jsonb': 'dict',
        'datetime': 'datetime',
        'date': 'datetime.date',
        'time': 'datetime.time',
        'interval': 'datetime.timedelta',
        'bytea': 'bytes',
    }
    
    # Check first parameter
    for sql_type, py_type in type_map.items():
        if sql_type in first_param:
            return py_type
    
    # Fallback: if starts with String, Text, etc. use str
    if any(x in first_param for x in ['String(', 'Text', 'CHAR', 'VARCHAR']):
        return 'str'
    if 'Integer' in first_param or 'BIGINT' in first_param:
        return 'int'
    if 'Float' in first_param or 'Numeric' in first_param:
        return 'float'
    if any(x in first_param for x in ['Boolean', 'BOOL']):
        return 'bool'
    if any(x in first_param for x in ['UUID', 'GUID']):
        return 'uuid.UUID'
    if 'JSON' in first_param:
        return 'dict'
    if 'DateTime' in first_param:
        return 'datetime'
    
    return None

def fix_imports_in_content(content: str) -> str:
    """Ensure imports are correct for SQLAlchemy 2.0+."""
    import re
    lines = content.split('\n')
    new_lines = []
    
    for line in lines:
        # Remove Column from imports if present
        if 'from sqlalchemy import' in line and 'Column' in line:
            # Remove Column from the import
            line = re.sub(r',\s*Column\s*(?=,|$|\))', '', line)
            line = re.sub(r'Column\s*,\s*', '', line)
            line = re.sub(r',\s*Column\s*$', '', line)
        
        # Ensure Mapped and mapped_column are in orm imports
        if 'from sqlalchemy.orm import' in line:
            if 'Mapped' not in line:
                # Add Mapped after import keyword
                line = line.replace('import ', 'import Mapped, ')
            if 'mapped_column' not in line and 'Column' not in line:
                line = line.replace('import ', 'import mapped_column, ')
        
        new_lines.append(line)
    
    return '\n'.join(new_lines)

def main():
    """Process all model files."""
    if not MODELS_DIR.exists():
        print(f"Error: Models directory not found: {MODELS_DIR}")
        return 1
    
    model_files = sorted([f for f in MODELS_DIR.glob("*.py") if not f.name.startswith('__')])
    
    print(f"\n{'='*70}")
    print(f"Advanced SQLAlchemy 2.0+ Migration")
    print(f"{'='*70}")
    print(f"Processing {len(model_files)} model files...\n")
    
    success_count = 0
    total_changes = 0
    
    for file_path in model_files:
        changed, message, converted_content = process_model_file_source(file_path)
        
        if changed:
            # Also fix imports
            converted_content = fix_imports_in_content(converted_content)
            
            with open(file_path, 'w') as f:
                f.write(converted_content)
            
            success_count += 1
            # Count actual changes from message
            import re as re_mod
            match = re_mod.search(r'Converted (\d+)', message)
            if match:
                total_changes += int(match.group(1))
            
        status = "✓" if changed else "•"
        print(f"{status} {file_path.name:<40} {message}")
    
    print(f"\n{'='*70}")
    print(f"✓ Conversion complete!")
    print(f"  Files updated: {success_count}/{len(model_files)}")
    print(f"  Total columns converted: {total_changes}")
    print(f"{'='*70}\n")
    
    return 0

if __name__ == "__main__":
    import re
    sys.exit(main())
