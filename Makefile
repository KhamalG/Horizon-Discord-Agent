.PHONY: dev-setup recover

dev-setup:
	npm ci
	npm run synth
	npx ts-node scripts/gen-env-json.ts
	@echo "Re-run 'npx ts-node scripts/gen-env-json.ts' after each deploy to refresh env.json."

recover:
	rm -rf cdk.out .cdk.staging node_modules
	npm ci
	@echo "Recovery complete. Run 'make dev-setup' to rebuild env.json."
