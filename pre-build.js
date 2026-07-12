const cp = require('child_process');
try {
  console.log("Running failsafe Convex deploy...");
  // Vercel 환경에서는 CONVEX_DEPLOY_KEY가 없거나 다를 수 있으므로 try-catch로 안전하게 감쌉니다.
  cp.execSync('npx convex deploy --typecheck try', { stdio: 'inherit' });
  console.log("Convex deploy finished successfully.");
} catch (e) {
  console.log('Convex deploy skipped or failed:', e.message);
}
