import { execSync } from 'child_process';
// Aquire Secrets from Bitwarden Secret Manager's CLI
export function getBWSecret(secretId) {
    try {
        const command = process.platform === 'win32'
            ? `bws secret get ${escapePowerShellArg(secretId)} | ConvertFrom-Json | Select-Object -ExpandProperty value`
            : `bws secret get ${secretId} | jq -r '.value'`;
        const output = execSync(command, {
            shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
            encoding: 'utf-8'
        }).trim();
        return output || null;
    }
    catch (error) {
        console.error('Error retrieving secret:', error);
        return null;
    }
}
// Shielding PowerShell Args
function escapePowerShellArg(arg) {
    return `'${arg.replace(/'/g, "''")}'`;
}
