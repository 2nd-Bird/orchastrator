import * as fs from 'fs';
import * as path from 'path';

export function initCommand(repoRoot: string): void {
  console.log('Initializing codex-agent...');

  // Create tasks directory
  const tasksDir = path.join(repoRoot, 'tasks');
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
    console.log('Created tasks/ directory');
  }

  // Create example task files
  const exampleTask1 = `# Add User Authentication

Implement user authentication with the following requirements:
- Add login and registration endpoints
- Use JWT tokens for authentication
- Add middleware to protect routes
- Include password hashing with bcrypt
`;

  const exampleTask2 = `# Create API Documentation

Generate API documentation with the following requirements:
- Document all endpoints
- Include request/response examples
- Add authentication requirements
- Use OpenAPI/Swagger format
`;

  fs.writeFileSync(path.join(tasksDir, 'task-1-auth.md'), exampleTask1);
  fs.writeFileSync(path.join(tasksDir, 'task-2-docs.md'), exampleTask2);
  console.log('Created example task files');

  // Create example tasks.yaml manifest
  const manifest = `tasks:
  - id: task-1
    file: tasks/task-1-auth.md
    description: Add user authentication

  - id: task-2
    file: tasks/task-2-docs.md
    description: Create API documentation
`;

  fs.writeFileSync(path.join(repoRoot, 'tasks.yaml'), manifest);
  console.log('Created tasks.yaml manifest');

  console.log('\nInitialization complete!');
  console.log('Edit tasks.yaml and task files, then run: codex-agent start --tasks tasks.yaml');
}
