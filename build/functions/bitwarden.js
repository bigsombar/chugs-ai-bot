// import { execSync } from 'child_process';
// import 'dotenv/config';
// import fs from 'fs/promises';
// // Secrets cache for dev build
// const devSecretsCache: Record<string, string> = {};
// const DEV_SECRETS_FILE = '../.dev-secrets.json';
// // Aquire Secrets from Bitwarden Secret Manager's CLI
// export function getBWSecret(secretId: string): string | null {
//     try {
//         const command = process.platform === 'win32'
//             ? `bws secret get ${escapePowerShellArg(secretId)} | ConvertFrom-Json | Select-Object -ExpandProperty value`
//             : `bws secret get ${secretId} | jq -r '.value'`;
//         const output = execSync(command, {
//             shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
//             encoding: 'utf-8'
//         }).trim();
//         return output || null;
//     } catch (error) {
//         console.error('Error retrieving secret:', error);
//         return null;
//     }
// }
// // Shielding PowerShell Args
// function escapePowerShellArg(arg: string): string {
//     return `'${arg.replace(/'/g, "''")}'`;
// }
import { execSync } from "child_process";
import "dotenv/config";
import fs from "fs/promises";
const DEV_SECRETS_FILE = 'dev/.dev-secrets.json';
export class BWSecretManager {
    devSecretsCache = {};
    // Check if running in development mode
    static get isDev() {
        return process.env.DEV === "true";
    }
    // Загружаем кэш из файла (только для DEV)
    async loadDevSecretsCache() {
        if (!BWSecretManager.isDev)
            return;
        try {
            const data = await fs.readFile(DEV_SECRETS_FILE, "utf-8");
            this.devSecretsCache = JSON.parse(data);
            console.log(">> Loaded secrets from cache");
        }
        catch {
            this.devSecretsCache = {};
            console.log(">> No secrets cache found. Will create new");
        }
    }
    // Сохраняем кэш в файл (только для DEV)
    async saveDevSecretsCache() {
        if (!BWSecretManager.isDev)
            return;
        await fs.writeFile(DEV_SECRETS_FILE, JSON.stringify(this.devSecretsCache, null, 2), "utf-8");
    }
    // Получить секрет (сначала из кэша, если DEV)
    async getSecret(secretId) {
        if (BWSecretManager.isDev) {
            if (Object.keys(this.devSecretsCache).length === 0) {
                await this.loadDevSecretsCache();
            }
            if (this.devSecretsCache[secretId]) {
                return this.devSecretsCache[secretId];
            }
        }
        // Если нет в кэше — запросить у Bitwarden
        const secret = this.getBWSecretFromBitwarden(secretId);
        if (secret && BWSecretManager.isDev) {
            this.devSecretsCache[secretId] = secret;
            await this.saveDevSecretsCache();
        }
        return secret;
    }
    // Получить секрет напрямую из Bitwarden CLI
    getBWSecretFromBitwarden(secretId) {
        try {
            const command = process.platform === "win32"
                ? `bws secret get ${escapePowerShellArg(secretId)} | ConvertFrom-Json | Select-Object -ExpandProperty value`
                : `bws secret get ${secretId} | jq -r '.value'`;
            const output = execSync(command, {
                shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
                encoding: "utf-8",
            }).trim();
            return output || null;
        }
        catch (error) {
            console.error("Error retrieving secret:", error);
            return null;
        }
    }
}
// Shielding PowerShell Args
function escapePowerShellArg(arg) {
    return `'${arg.replace(/'/g, "''")}'`;
}
