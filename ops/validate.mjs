import { loadControlPlane } from './lib/schema.mjs';

function main() {
  const snapshot = loadControlPlane(process.cwd());
  console.log(`Validated control plane for ${snapshot.project.project.name}`);
  console.log(`Tasks: ${snapshot.state.tasks.length}`);
  console.log(`Events: ${snapshot.events.length}`);
  console.log(`Roles: ${snapshot.agents.roles.length}`);
  console.log(`Legacy ignored: ${snapshot.project.legacy_ignored.length}`);
}

main();
