const { Scenes, Markup } = require("telegraf");
const { createAdminInvite, getAdminList, toggleAdminStatus } = require("../helpers/api");

const superadminScene = new Scenes.BaseScene("superadmin");

// 🔹 Kirganda menyu
superadminScene.enter((ctx) => {
  ctx.reply(
    "🔱 SuperAdmin panel:",
    Markup.keyboard([
      ["➕ Admin yaratish"],
      ["📋 Adminlar ro'yxati"]
    ]).resize()
  );
});

// 🔹 Admin yaratish (referal link)
superadminScene.hears("➕ Admin yaratish", async (ctx) => {
  const telegramId = ctx.from.id;
  try {
    const res = await createAdminInvite(telegramId);
    ctx.reply(`Admin uchun referal link:\n${res.inviteLink}`);
  } catch (error) {
    console.error("Link yaratishda xatolik:", error);
    ctx.reply("❌ Link yaratishda xatolik!");
  }
});

// 🔹 Adminlar ro'yxati
superadminScene.hears("📋 Adminlar ro'yxati", async (ctx) => {
  const telegramId = ctx.from.id;

  try {
    const res = await getAdminList(telegramId);
    const admins = res.admins || [];

    if (admins.length === 0) {
      return ctx.reply("📭 Hozircha hech qanday admin mavjud emas.");
    }

    for (const admin of admins) {
      const status = admin.isActive ? "✅ Faol" : "❌ Bloklangan";
      await ctx.replyWithHTML(
        `<b>@${admin.username || "no_username"}</b>\nHolati: ${status}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              admin.isActive ? "🔴 Bloklash" : "🟢 Faollashtirish",
              `toggle_${admin._id}`
            )
          ]
        ])
      );
    }
  } catch (error) {
    console.error("Adminlar ro'yxatini olishda xatolik:", error.response?.data || error.message);
    ctx.reply("❌ Adminlar ro'yxatini olishda xatolik yuz berdi.");
  }
});

// 🔹 Adminni bloklash / faollashtirish
superadminScene.action(/toggle_(.+)/, async (ctx) => {
  const adminId = ctx.match[1];
  const telegramId = ctx.from.id;

  try {
    const res = await toggleAdminStatus(telegramId, adminId);

    await ctx.editMessageText(
      `👤 <b>@${res.admin.username || "Admin"}</b> holati o'zgartirildi!\nYangi holati: ${
        res.admin.isActive ? "✅ Faol" : "❌ Bloklangan"
      }`,
      { parse_mode: "HTML" }
    );

    await ctx.answerCbQuery("✅ Holat o'zgartirildi!");
  } catch (error) {
    console.error("Holatni o‘zgartirishda xatolik:", error.response?.data || error.message);
    await ctx.answerCbQuery("❌ Holatni o'zgartirishda xatolik!");
  }
});

module.exports = { superadminScene };
