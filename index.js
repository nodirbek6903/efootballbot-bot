const { Telegraf, Scenes, session, Markup } = require("telegraf");
const dotenv = require("dotenv");
const {
  registerUser,
  startTournament,
  getTeamsByTournamentId,
} = require("./helpers/api");
const { superadminScene } = require("./scenes/superadminScene");
const { adminScene } = require("./scenes/adminScene");
const { playerScene } = require("./scenes/playerScene");

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
global.bot = bot;

const stage = new Scenes.Stage([superadminScene, adminScene, playerScene]);
bot.use(session());
bot.use(stage.middleware());

bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || "unknown";
  const args = ctx.message.text.split(" ");
  const param = args[1] || null;

  let inviteToken = null;
  let tournamentId = null;

  if (param && param.length === 24) tournamentId = param;
  else if (param) inviteToken = param;

  const res = await registerUser(telegramId, username, inviteToken);
  const user = res.user;

  if (tournamentId) {
    ctx.session.tournamentId = tournamentId;
    try {
      const data = await getTeamsByTournamentId(telegramId, tournamentId);
      const tournament = data.tournament;

      await ctx.replyWithHTML(
        `🏆 <b>${tournament.name}</b> turniriga hush kelibsiz!\n\n` +
          `Jamoalar soni: ${tournament.teamCount}\n` +
          `Har jamoada: ${tournament.playersPerTeam} o‘yinchi\n\n`,
        Markup.keyboard([["🎯 Turnirga qo‘shilish"], ["📊 Statistikam"]]).resize()
      );
    } catch {
      return ctx.reply("❌ Turnir topilmadi yoki muddati tugagan.");
    }
  }

  if (user.role === "superadmin") return ctx.scene.enter("superadmin");
  if (user.role === "admin") return ctx.scene.enter("admin");
  return ctx.scene.enter("player");
});

bot.action(/start_(.+)/, async (ctx) => {
  const tournamentId = ctx.match[1];
  const telegramId = ctx.from.id;
  try {
    await startTournament(telegramId, tournamentId);
    ctx.reply("✅ Turnir boshlandi!");
  } catch (error) {
    console.error(error.response?.data || error.message);
    ctx.reply("❌ Turnirni boshlashda xatolik yuz berdi.");
  }
});

bot.command("admin", (ctx) => ctx.scene.enter("admin"));
bot.command("player", (ctx) => ctx.scene.enter("player"));
bot.command("superadmin", (ctx) => ctx.scene.enter("superadmin"));

// 🟢 BOTNI ISHGA TUSHIRISH
bot.launch();
console.log("🤖 Bot polling mode orqali ishga tushdi!");

// Yopilishda toza to‘xtatish
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
