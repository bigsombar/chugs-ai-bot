var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { ApplicationCommandOptionType } from "discord.js";
import { Discord, Slash, SlashChoice, SlashOption } from "discordx";
let Example = class Example {
    async min(input, interaction) {
        await interaction.reply(`${input}`);
    }
};
__decorate([
    Slash({ description: "choice-test", name: "choice-test" }),
    __param(0, SlashChoice({ name: "alex", value: "alex" })),
    __param(0, SlashChoice({ name: "mike", value: "mike" })),
    __param(0, SlashOption({
        description: "input",
        name: "input",
        required: true,
        type: ApplicationCommandOptionType.String,
    }))
], Example.prototype, "min", null);
Example = __decorate([
    Discord()
], Example);
export { Example };
