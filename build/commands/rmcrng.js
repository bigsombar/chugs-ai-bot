var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key, desc) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Discord, Slash, SlashOption } from "discordx";
import { ApplicationCommandOptionType, TextChannel } from "discord.js";

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

// Защищённые фразы - сообщения с этими текстами не удаляются
const PROTECTED_PHRASES = [
    "в РПГ нельзя ставить высокую сложность",
    "я скорее куплю айфон чем хоть еще раз запущу 3 дерьмака",
    "Гайд по выключению Microsoft Defender",
    "давать выбор вообще плохо"
];

// ID целевого пользователя
const TARGET_USER_ID = "456535168316997634";

// Дата ограничения - 1 января 2026
const CUTOFF_DATE = new Date("2026-01-01T00:00:00.000Z");

// Интервал в миллисекундах (20 секунд)
const INTERVAL_MS = 20000;

// ============================================
// ХРАНИЛИЩЕ АКТИВНЫХ ИНТЕРВАЛОВ
// ============================================

const activeIntervals = new Map();

// ============================================
// КОМАНДА
// ============================================

let RmcrngCommand = class RmcrngCommand {
    
    /**
     * Проверяет, содержит ли сообщение защищённую фразу
     */
    containsProtectedPhrase(content) {
        if (!content) return false;
        const lowerContent = content.toLowerCase();
        return PROTECTED_PHRASES.some(phrase => 
            lowerContent.includes(phrase.toLowerCase())
        );
    }

    /**
     * Ищет и удаляет самое старое сообщение пользователя в канале
     */
    async findAndDeleteOldest(channel) {
        try {
            // Получаем сообщения из канала (до 100 за раз)
            const messages = await channel.messages.fetch({ limit: 100 });
            
            // Фильтруем сообщения по критериям:
            // 1. От целевого пользователя
            // 2. Созданные до 1 января 2026
            // 3. Не содержат защищённых фраз
            const targetMessages = messages.filter(msg => {
                const isTargetUser = msg.author.id === TARGET_USER_ID;
                const isBeforeCutoff = msg.createdAt < CUTOFF_DATE;
                const isNotProtected = !this.containsProtectedPhrase(msg.content);
                return isTargetUser && isBeforeCutoff && isNotProtected;
            });

            if (targetMessages.size === 0) {
                console.log(`[rmcrng] Нет подходящих сообщений в канале ${channel.name}`);
                return false;
            }

            // Находим самое старое сообщение
            let oldestMessage = null;
            for (const [id, msg] of targetMessages) {
                if (!oldestMessage || msg.createdAt < oldestMessage.createdAt) {
                    oldestMessage = msg;
                }
            }

            if (oldestMessage) {
                const dateStr = oldestMessage.createdAt.toISOString();
                const contentPreview = oldestMessage.content?.substring(0, 50) || "(пусто)";
                console.log(`[rmcrng] Удаляю сообщение от ${dateStr}: "${contentPreview}..."`);
                
                await oldestMessage.delete();
                console.log(`[rmcrng] Сообщение успешно удалено`);
                return true;
            }

            return false;
        }
        catch (error) {
            console.error("[rmcrng] Ошибка при поиске/удалении сообщения:", error);
            return false;
        }
    }

    /**
     * Запускает процесс удаления сообщений
     */
    async handleStart(interaction) {
        const guildId = interaction.guildId;
        
        // Проверяем, не запущен ли уже процесс
        if (activeIntervals.has(guildId)) {
            await interaction.reply({
                content: "⚠️ Процесс уже запущен! Используйте `/rmcrng stop` для остановки.",
                ephemeral: true
            });
            return;
        }

        // Проверяем тип канала
        const channel = interaction.channel;
        if (!(channel instanceof TextChannel)) {
            await interaction.reply({
                content: "❌ Команда работает только в текстовых каналах.",
                ephemeral: true
            });
            return;
        }

        // Отправляем ответ
        await interaction.reply({
            content: `🔄 **Запуск удаления старых сообщений**\n` +
                     `👤 Пользователь: <@${TARGET_USER_ID}>\n` +
                     `📅 До: ${CUTOFF_DATE.toLocaleDateString("ru-RU")}\n` +
                     `⏱️ Интервал: ${INTERVAL_MS / 1000} сек.\n` +
                     `🛡️ Защищённых фраз: ${PROTECTED_PHRASES.length}\n\n` +
                     `Используйте \`/rmcrng stop\` для остановки.`
        });

        // Запускаем интервал
        const self = this;
        const intervalId = setInterval(async () => {
            await self.findAndDeleteOldest(channel);
        }, INTERVAL_MS);

        activeIntervals.set(guildId, { 
            interval: intervalId, 
            channelId: channel.id 
        });

        // Первый запуск сразу
        await this.findAndDeleteOldest(channel);
    }

    /**
     * Останавливает процесс удаления
     */
    async handleStop(interaction) {
        const guildId = interaction.guildId;
        
        if (!activeIntervals.has(guildId)) {
            await interaction.reply({
                content: "ℹ️ Процесс удаления не запущен на этом сервере.",
                ephemeral: true
            });
            return;
        }

        const { interval } = activeIntervals.get(guildId);
        clearInterval(interval);
        activeIntervals.delete(guildId);

        await interaction.reply({
            content: "✅ Процесс удаления сообщений остановлен."
        });
    }

    /**
     * Показывает статус процесса
     */
    async handleStatus(interaction) {
        const guildId = interaction.guildId;
        
        if (!activeIntervals.has(guildId)) {
            await interaction.reply({
                content: "ℹ️ Процесс удаления не запущен.\n" +
                         "Используйте `/rmcrng start` для запуска.",
                ephemeral: true
            });
            return;
        }

        const { channelId } = activeIntervals.get(guildId);
        await interaction.reply({
            content: `🔄 **Процесс удаления активен**\n` +
                     `📍 Канал: <#${channelId}>\n` +
                     `👤 Пользователь: <@${TARGET_USER_ID}>\n` +
                     `⏱️ Интервал: ${INTERVAL_MS / 1000} сек.\n` +
                     `🛡️ Защищённых фраз: ${PROTECTED_PHRASES.length}`
        });
    }

    /**
     * Главная функция обработки команды
     */
    async rmcrng(action, interaction) {
        switch (action.toLowerCase()) {
            case "start":
                await this.handleStart(interaction);
                break;
            case "stop":
                await this.handleStop(interaction);
                break;
            case "status":
                await this.handleStatus(interaction);
                break;
            default:
                await interaction.reply({
                    content: "❌ Неизвестное действие. Используйте: `start`, `stop` или `status`.",
                    ephemeral: true
                });
        }
    }
};

__decorate([
    Slash({ description: "Удаление старых сообщений", name: "rmcrng" }),
    __param(0, SlashOption({
        description: "Действие: start / stop / status",
        name: "action",
        required: true,
        type: ApplicationCommandOptionType.String
    }))
], RmcrngCommand.prototype, "rmcrng", null);

RmcrngCommand = __decorate([
    Discord()
], RmcrngCommand);

export { RmcrngCommand };
