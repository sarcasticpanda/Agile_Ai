# GSD Config for AgileAI

mode: sequential-verified
task_source: brain/bug_list.md
verification: run after every bug fix
success_criteria: browser confirms feature works
on_failure: debug and retry, do not skip
max_retries: 3