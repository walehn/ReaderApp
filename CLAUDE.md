# Claude Code Guidelines

1. All output must be in Korean.

2. Use Serena tools first when available.

3. When generating any script, begin with comments that clearly explain:
- the script’s role/purpose
- available options/flags/configurations
- expected outputs/results
- detailed usage instructions

4. When modifying code, also update related comments accordingly.
If options are added/changed, default values are modified, or output formats are altered, ensure that:
- header comments
- usage examples
are kept fully synchronized.

5. Keep comments, option defaults, and usage examples aligned at all times.

6. Create a git commit whenever significant code updates are made.
This includes:
- Adding new features or functionality
- Fixing bugs
- Refactoring existing code
- Updating configurations or dependencies