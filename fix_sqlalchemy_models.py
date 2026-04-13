#!/usr/bin/env python3
"""
SQLAlchemy 2.0+ Migration Script for Model Files

Converts old-style Column() declarations to new-style mapped_column() with type hints.
"""

import os
import re
from pathlib import Path
from typing import Optional, Tuple

MODELS_DIR = Path("backend/app/models")
CHANGES_LOG = []

# Type mapping from Python types to SQLAlchemy types
TYPE_MAPPING = {
    "float": "Float",
    "int": "Integer",
    "bool": "Boolean",
    "str": "String",
}

def extract_column_info(column_def: str) -> Tuple[str, str, str]:
    """Extract name, type annotation, and column declaration from a line."""
    # Match: field_name = Column(...) or field_name: Mapped[type] = Column(...)
    match = re.match(r'\s*(\w+)\s*(?::\s*Mapped\[([^\]]+)\])?\s*=\s*Column\((.*)\)\s*(?:#.*)?$', column_def)
    if match:
        name = match.group(1)
        mapped_type = match.group(2)
        col_args = match.group(3)
        return name, mapped_type, col_args
    return None, None, None

def infer_type_from_column(col_args: str) -> Optional[str]:
    """Infer Python type from Column declaration."""
    col_args_lower = col_args.lower()
    
    # Check for explicit type declarations
    if "string(" in col_args_lower:
        return "str"
    if "text(" in col_args_lower or "text," in col_args_lower:
        return "str"
    if "integer" in col_args_lower:
        return "int"
    if "float" in col_args_lower:
        return "float"
    if "boolean" in col_args_lower:
        return "bool"
    if "uuid" in col_args_lower:
        return "uuid.UUID"
    if "json" in col_args_lower:
        return "dict"
    if "datetime" in col_args_lower:
        return "datetime"
    
    return None

def is_optional(col_args: str) -> bool:
    """Check if column is nullable."""
    return "nullable=True" in col_args

def convert_column_line(line: str, file_content: str) -> str:
    """Convert a single Column line to mapped_column with type hints."""
    # Extract the field name and column definition
    match = re.match(r'(\s*)(\w+)\s*(?::\s*Mapped\[([^\]]+)\])?\s*=\s*Column\((.*)\)\s*(#.*)?$', line)
    
    if not match:
        return line
    
    indent = match.group(1)
    name = match.group(2)
    mapped_type = match.group(3)
    col_args = match.group(4)
    comment = match.group(5) or ""
    
    # Infer type if not already present
    if not mapped_type:
        mapped_type = infer_type_from_column(col_args)
    
    if not mapped_type:
        # Can't infer type, return original
        return line
    
    # Check if optional
    is_opt = is_optional(col_args)
    
    # Format type annotation
    if is_opt and not mapped_type.startswith("Optional["):
        type_hint = f"Optional[{mapped_type}]"
    else:
        type_hint = mapped_type
    
    # Build new line
    new_line = f"{indent}{name}: Mapped[{type_hint}] = mapped_column({col_args})"
    if comment:
        new_line += f" {comment}"
    
    return new_line

def fix_imports(content: str) -> str:
    """Fix imports to remove Column and ensure Mapped/mapped_column are present."""
    # Remove Column from import if present
    content = re.sub(
        r'from sqlalchemy import ([^)]*?), ?Column, ?([^)]*)',
        r'from sqlalchemy import \1, \2',
        content
    )
    content = re.sub(
        r'from sqlalchemy import Column, ?([^)]*)',
        r'from sqlalchemy import \1',
        content
    )
    # Remove any trailing comma issues
    content = re.sub(r'from sqlalchemy import ([^)]*),\s*$', r'from sqlalchemy import \1', content, flags=re.MULTILINE)
    
    # Ensure Mapped and mapped_column are imported
    if 'from sqlalchemy.orm import' in content:
        if 'Mapped' not in content or 'mapped_column' not in content:
            # Add to existing import
            content = re.sub(
                r'from sqlalchemy\.orm import ([^)]*)',
                lambda m: fix_orm_imports(m.group(1)),
                content
            )
    
    return content

def fix_orm_imports(imports_str: str) -> str:
    """Ensure Mapped and mapped_column are in orm imports."""
    imports = [i.strip() for i in imports_str.split(',')]
    imports = [i for i in imports if i]  # Remove empties
    
    if 'Mapped' not in imports_str:
        imports.insert(0, 'Mapped')
    if 'mapped_column' not in imports_str:
        imports.insert(1, 'mapped_column')
    
    return f"from sqlalchemy.orm import {', '.join(imports)}"

def process_model_file(file_path: Path) -> Tuple[bool, str]:
    """Process a single model file."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Check if file uses old Column style
        if 'Column(' not in content or 'mapped_column' in content:
            return False, "Not using old Column style"
        
        original_content = content
        
        # Fix imports
        content = fix_imports(content)
        
        # Convert Column lines to mapped_column
        # Find all class definitions and convert their columns
        # This is a complex regex, so we do line-by-line conversion
        lines = content.split('\n')
        converted_lines = []
        in_class = False
        
        for i, line in enumerate(lines):
            # Check if we're in a model class
            if re.match(r'^class\s+\w+\(Base\)', line):
                in_class = True
            elif in_class and line.strip() and not line.startswith(' '):
                in_class = False
            
            # Convert Column lines in classes
            if in_class and ' = Column(' in line:
                converted_line = convert_column_line(line, content)
                if converted_line != line:
                    converted_lines.append(converted_line)
                else:
                    converted_lines.append(line)
            else:
                converted_lines.append(line)
        
        content = '\n'.join(converted_lines)
        
        # Write back only if changed
        if content != original_content:
            with open(file_path, 'w') as f:
                f.write(content)
            return True, "Converted to new SQLAlchemy style"
        else:
            return False, "No changes needed"
            
    except Exception as e:
        return False, f"Error: {str(e)}"

def main():
    """Main function to process all model files."""
    if not MODELS_DIR.exists():
        print(f"Models directory not found: {MODELS_DIR}")
        return
    
    model_files = sorted(MODELS_DIR.glob("*.py"))
    
    print(f"\nProcessing {len(model_files)} model files...")
    print("=" * 70)
    
    success_count = 0
    for file_path in model_files:
        if file_path.name.startswith('__'):
            continue
        
        changed, message = process_model_file(file_path)
        status = "✓" if changed else "•"
        print(f"{status} {file_path.name:<40} {message}")
        
        if changed:
            success_count += 1
    
    print("=" * 70)
    print(f"\nConversion complete! Updated {success_count}/{len(model_files)} files.")

if __name__ == "__main__":
    main()
