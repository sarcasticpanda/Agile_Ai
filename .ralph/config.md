# Ralph Loop Config

run_after_each_fix: true
test_command: 
  backend: cd server && node -e "require('./server.js')" (check no startup errors)
  frontend: check browser console for errors after each change
verify_method: browser_check
report_to: brain/progress.md