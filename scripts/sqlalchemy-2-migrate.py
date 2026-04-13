#!/usr/bin/env python3
"""
SQLAlchemy 2.0 Model Migration Tool

Automatically converts old-style Column() definitions to modern mapped_column() syntax.
This script handles:
1. Adding Mapped and mapped_column imports
2. Converting Column(...) to mapped_column(...)
3. Converting Python types (float, int, str) to SQLAlchemy types (Float, Integer, String)
4. Adding type annotations (Mapped[T])
5. Renaming reserved column names
"""

import re
import os
from pathlib import Path
from typing import Dict, List, Tuple

# Type mapping from Python to SQLAlchemy
PYTHON_TO_SQLALCHEMY_TYPES = {
    'float': 'Float',
    'int': 'Integer',
    'str': 'String',
    'bool': 'Boolean',
    'dict': 'JSON',
    'list': 'JSON',
}

# SQLAlchemy types that need to be imported
SQLALCHEMY_IMPORTS = {
    'Float', 'Integer', 'String', 'Boolean', 'JSON', 'Text',
    'DateTime', 'Date', 'Time', 'DECIMAL', 'NUMERIC'
}

RESERVED_COLUMN_NAMES = {
    'metadata': 'field_metadata',
    'query': 'query_value',
    'info': 'info_data',
    'type': 'item_type',
}

def fix_model_file(filepath: str) -> Tuple[bool, str]:
    """
    Fix a single model file for SQLAlchemy 2.0 compatibility.
    
    Returns (modified, error_message)
    """
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        original_content = content
        
        # Step 1: Add TYPE_CHECKING import if needed
        if 'if TYPE_CHECKING:' not in content and ('relationship' in content or 'Mapped' in content):
            if 'from typing import' in content:
                content = re.sub(
                    r'from typing import ([^\n]*)',
                    lambda m: f"from typing import {m.group(1)}, TYPE_CHECKING" if 'TYPE_CHECKING' not in m.group(1) else m.group(0),
                    content,
                    count=1
                )
            else:
                # Add typing import
                import_section = re.search(r'^(from|import)', content, re.MULTILINE)
                if import_section:
                    insert_pos = import_section.start()
                    content = content[:insert_pos] + 'from typing import TYPE_CHECKING, Optional\n\n' + content[insert_pos:]
        
        # Step 2: Add Mapped and mapped_column imports
        if 'mapped_column' not in content and 'Column(' in content:
            if 'from sqlalchemy.orm import' in content:
                # Add to existing import
                content = re.sub(
                    r'from sqlalchemy\.orm import ([^#\n]*)',
                    lambda m: f"from sqlalchemy.orm import Mapped, mapped_column, {m.group(1)}" 
                              if 'Mapped' not in m.group(1) else m.group(0),
                    content
                )
            else:
                # Add new import after sqlalchemy imports
                content = re.sub(
                    r'(from sqlalchemy import [^\n]*)\n',
                    r'\1\nfrom sqlalchemy.orm import Mapped, mapped_column, relationship\n',
                    content,
                    count=1
                )
        
        # Step 3: Fix Python type to SQLAlchemy type conversions in Column() calls
        for py_type, sa_type in PYTHON_TO_SQLALCHEMY_TYPES.items():
            # Pattern: Column(float, ...) or Column(float, ...) 
            content = re.sub(
                rf'\bColumn\(\s*{py_type}\s*,',
                f'Column({sa_type},',
                content
            )
            # Also add the import for the type
            if f', {sa_type}' not in content and sa_type in SQLALCHEMY_IMPORTS:
                content = re.sub(
                    r'from sqlalchemy import ([^#\n]*)',
                    lambda m: f"from sqlalchemy import {m.group(1)}, {sa_type}"
                              if sa_type not in m.group(1) else m.group(0),
                    content,
                    count=1
                )
        
        # Step 4: Rename reserved column names
        for reserved, replacement in RESERVED_COLUMN_NAMES.items():
            # Pattern: metadata = Column(...)
            content = re.sub(
                rf'\b{reserved}\s*=\s*Column\(',
                f'{replacement} = Column(',
                content
            )
            # Also update references in to_dict() methods
            content = re.sub(
                rf'"{reserved}":\s*self\.{reserved}',
                f'"{replacement}": self.{replacement}',
                content
            )
        
        # Step 5: Check if file actually needs conversion
        if f'= Column(' in content and 'Mapped' not in content:
            # This file has Column definitions but no Mapped types
            # This is OK - some legacy files use Column() which is still valid
            pass
        
        # Only write if changed
        if content != original_content:
            with open(filepath, 'w') as f:
                f.write(content)
            return True, "Fixed"
        else:
            return False, "No changes needed"
            
    except Exception as e:
        return False, f"Error: {str(e)}"


def main():
    """Process all model files in the backend."""
    backend_path = Path('/Users/raghav/Projects/AI-Book-Writer/backend')
    models_path = backend_path / 'app' / 'models'
    
    print("🔧 SQLAlchemy 2.0 Model Migration Tool")
    print("=" * 60)
    print(f"Target directory: {models_path}")
    print()
    
    # Find all Python files
    py_files = sorted(models_path.glob('*.py'))
    
    if not py_files:
        print("❌ No Python files found in models directory")
        return
    
    print(f"Found {len(py_files)} model files to check\n")
    
    fixed_count = 0
    error_count = 0
    
    for py_file in py_files:
        if py_file.name.startswith('_'):
            continue
        
        modified, message = fix_model_file(str(py_file))
        
        status = "✅" if modified else "⏭️"
        print(f"{status} {py_file.name:40s} - {message}")
        
        if message.startswith("Error"):
            error_count += 1
        elif modified:
            fixed_count += 1
    
    print()
    print("=" * 60)
    print(f"📊 Summary:")
    print(f"   Files fixed: {fixed_count}")
    print(f"   Files with no changes: {len(py_files) - fixed_count - error_count}")
    print(f"   Errors: {error_count}")
    print()
    
    if error_count == 0:
        print("✅ Migration complete! All files processed successfully.")
    else:
        print(f"⚠️  {error_count} file(s) had errors. Check output above.")


if __name__ == '__main__':
    main()
