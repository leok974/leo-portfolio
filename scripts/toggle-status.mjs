// scripts/toggle-status.mjs
// Toggle project status between in-progress and completed
// Usage: node scripts/toggle-status.mjs <slug> [in-progress|completed]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectsPath = path.join(__dirname, '..', 'projects.json');

// Parse command line arguments
const [,, slug, targetStatus = 'completed'] = process.argv;

// Validate arguments
if (!slug) {
  console.error('❌ Error: Project slug is required');
  console.error('\nUsage:');
  console.error('  node scripts/toggle-status.mjs <slug> [in-progress|completed]');
  console.error('\nExamples:');
  console.error('  node scripts/toggle-status.mjs clarity completed');
  console.error('  node scripts/toggle-status.mjs ledgermind in-progress');
  console.error('  npm run proj:complete clarity');
  process.exit(1);
}

if (!['in-progress', 'completed'].includes(targetStatus)) {
  console.error(`❌ Error: Invalid status "${targetStatus}". Must be "in-progress" or "completed"`);
  process.exit(1);
}

// Read and parse projects.json
let projects;
try {
  const raw = fs.readFileSync(projectsPath, 'utf8');
  projects = JSON.parse(raw);
} catch (error) {
  console.error(`❌ Error reading projects.json: ${error.message}`);
  process.exit(1);
}

// Find the project
if (!projects[slug]) {
  console.error(`❌ Error: Project "${slug}" not found in projects.json`);
  console.error('\nAvailable projects:');
  Object.keys(projects).forEach(key => {
    console.error(`  - ${key} (${projects[key].title})`);
  });
  process.exit(1);
}

// Get current status
const currentStatus = projects[slug].status || 'in-progress';

// Check if already at target status
if (currentStatus === targetStatus) {
  console.log(`ℹ️  Project "${slug}" is already marked as ${targetStatus}`);
  process.exit(0);
}

// Update status
projects[slug].status = targetStatus;

// Add date_completed if moving to completed
if (targetStatus === 'completed' && !projects[slug].date_completed) {
  projects[slug].date_completed = new Date().toISOString().slice(0, 10);
  console.log(`📅 Set completion date to ${projects[slug].date_completed}`);
}

// Remove date_completed if moving back to in-progress
if (targetStatus === 'in-progress' && projects[slug].date_completed) {
  delete projects[slug].date_completed;
  console.log(`🗑️  Removed completion date`);
}

// Write back to file with proper formatting
try {
  fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2) + '\n');
  console.log(`✅ Successfully updated ${slug}: ${currentStatus} → ${targetStatus}`);

  if (targetStatus === 'completed') {
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Run "npm run generate-projects" to regenerate project pages`);
    console.log(`   2. Check the completed projects page: completed.html`);
  } else {
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Run "npm run generate-projects" to regenerate project pages`);
    console.log(`   2. Project will appear on the main homepage`);
  }
} catch (error) {
  console.error(`❌ Error writing projects.json: ${error.message}`);
  process.exit(1);
}
