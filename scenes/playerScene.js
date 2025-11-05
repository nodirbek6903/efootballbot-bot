const { Scenes, Markup } = require("telegraf");
const {
  joinTournament,
  getTeamsByTournamentId,
  getMyTournaments,
  getMyStats,
  getPlayerMatches,
  submitResult
} = require("../helpers/api");

const playerScene = new Scenes.BaseScene("player");

playerScene.enter((ctx) => {
  ctx.reply(
    "🎮 Player menyu:",
    Markup.keyboard([
      ["🎯 Turnirga qo'shilish"],
      ["🏆 Mening turnirlarim"],
      ["📊 Statistikam"],
      ["🎮 Mening o'yinlarim"],
      ["📤 Natija yuborish"],
    ]).resize()
  );
});

// 🎯 Turnirga qo'shilish — endi turnir detallarini ko'rsatadi va Jamoalar tugmasi bor
playerScene.hears("🎯 Turnirga qo'shilish", async (ctx) => {
  try {
    const tournamentId = ctx.session.tournamentId;
    const telegramId = String(ctx.from.id);

    if (!tournamentId) {
      return ctx.reply("❌ Siz turnir linki orqali kirishingiz kerak!");
    }

    const data = await getTeamsByTournamentId(telegramId, tournamentId);
    const { tournament } = data;

    if (!tournament) {
      return ctx.reply("❌ Turnir topilmadi.");
    }

    const msg =
      `<b>${tournament.name}</b>\n\n` +
      `🔢 Jamoalar soni: ${tournament.teamCount}\n` +
      `👥 Har jamoada максимал: ${tournament.playersPerTeam}\n` +
      `⏱ Holat: ${
        tournament?.status === "pending"
          ? "Turnirga hali start berilmagan jamoalar to'lgandan keyin start beriladi."
          : tournament?.status === "active"
          ? "Faol"
          : tournament?.status === "completed"
          ? "Turnir yakunlangan"
          : "Belgilanmagan"
      }\n\n` +
      `Jamoalardan birini tanlab, o'zingizga jamoa band qilishingiz mumkin.`;

    await ctx.replyWithHTML(
      msg,
      Markup.inlineKeyboard([
        Markup.button.callback("👥 Jamoalar ro'yxati", "show_teams"),
        Markup.button.callback("⬅️ Orqaga", "back_to_menu"),
      ])
    );
  } catch (err) {
    console.error("show tournament details error:", err);
    ctx.reply("❌ Turnir ma'lumotini olishda xatolik yuz berdi.");
  }
});

playerScene.hears("🏆 Mening turnirlarim", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const data = await getMyTournaments(telegramId);

  if (!data.tournaments || data.tournaments.length === 0) {
    return ctx.reply("📭 Siz hali hech qanday turnirda ishtirok etmagansiz.");
  }

  let msg = "🏆 Siz qatnashgan turnirlar:\n\n";

  data.tournaments.forEach((t, i) => {
    msg += `${i + 1}. <b>${t.name}</b>\n`;
    if (t.team) {
      msg += `   Jamoa: ${t.team.name}\n`;
    } else {
      msg += `   Jamoa: ❌ Yo'q\n`;
    }
    msg += `   Holat: ${t.status || "-"}\n\n`;
  });

  return ctx.replyWithHTML(msg);
});

// Statistikam (siz xohlagancha backend bilan bog'lanadi)
playerScene.hears("📊 Statistikam", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const data = await getMyTournaments(telegramId)

  if(!data.tournaments || data.tournaments.length === 0){
    return ctx.reply("Siz hali hech qanday turnirda qatnashmagansiz.")
  }

  const keyboard = data.tournaments.map(t => [
    Markup.button.callback(t.name, `stats_tournament_${t.tournamentId}`)
  ])

  return ctx.reply("Qaysi turnir bo'yicha statistikani ko'rmoqchisiz?",
    Markup.inlineKeyboard(keyboard)
  )
});

// mening oyinlarim
playerScene.hears("🎮 Mening o'yinlarim", async (ctx) => {
  const telegramId = String(ctx.from.id)
  const data = await getMyTournaments(telegramId)

  if (!data.tournaments || data.tournaments.length === 0) {
    return ctx.reply("📭 Siz hali hech qanday turnirda qatnashmagansiz.")
  }

  const activeTournaments = data.tournaments.filter(t => t.status === "active")

  if(activeTournaments.length === 0){
    return ctx.reply("⏳ Turnirlar hali boshlanmagan (status = active bo'lishi kerak).")
  }

  const keyboard = activeTournaments.map(t => [
    Markup.button.callback(t.name, `matches_tournament_${t.tournamentId}`)
  ])

  return ctx.reply(
    "🎮 Qaysi turnirdagi o'yinlarni ko'rmoqchisiz?",
    Markup.inlineKeyboard(keyboard)
  )
})

playerScene.hears("📤 Natija yuborish", async (ctx) => {
  const telegramId = String(ctx.from.id)
  const data = await getMyTournaments(telegramId)

  const activeTournaments = data?.tournaments?.filter(t => t.status === "active") || []

  if(activeTournaments.length === 0){
    return ctx.reply("Sizda faol turnir mavjud emas yoki turnir hali boshlanmagan")
  }

  const keyboard = activeTournaments.map(t => [
    Markup.button.callback(t.name, `result_tournament_${t.tournamentId}`)
  ])

  return ctx.reply(
    "Qaysi turnirdagi o'yinga natija yubormoqchisiz?", 
    Markup.inlineKeyboard(keyboard)
  )
})


playerScene.action(/result_tournament_(.+)/, async (ctx) => {
  const telegramId = String(ctx.from.id)
  const tournamentId = ctx.match[1]

  const res = await getPlayerMatches(telegramId, tournamentId)
  if(!res.success || res.matches.length === 0){
    return ctx.reply("Ushbu turnirda siz ishtirok etgan o'yinlar topilmadi.")
  }

  const matches = res?.matches
  const keyboard = matches.map(m => {
  const teamAPlayers = m.teamA.players.map(p => `@${p.username || p.telegramId}`).join(", ");
  const teamBPlayers = m.teamB.players.map(p => `@${p.username || p.telegramId}`).join(", ");

  return [
    Markup.button.callback(
      `${m.teamA.name} (${teamAPlayers}) vs ${m.teamB.name} (${teamBPlayers})`,
      `result_match_${m._id}`
    )
  ]
});


  await ctx.reply("Qaysi o'yin uchun natija yubormoqchisiz?", Markup.inlineKeyboard(keyboard))
})

playerScene.action(/result_match_(.+)/, async (ctx) => {
  const matchId = ctx.match[1]
  ctx.session.waitingForResult = true
  ctx.session.selectedMatchId = matchId

  await ctx.reply("Natijani kiriting (masalan: <b>3 - 2</b>)", {parse_mode:"HTML"})
})


// Orqaga tugmasi — menyuga qaytish
playerScene.action("back_to_menu", async (ctx) => {
  try {
    await ctx.deleteMessage();
  } catch (e) {
    /* ignore */
  }
  return playerScene.enter(ctx);
});

// Jamoalar ro'yxatini KO‘RISH (inline button-only list)
playerScene.action("show_teams", async (ctx) => {
  try {
    const telegramId = String(ctx.from.id);
    const tournamentId = ctx.session.tournamentId;

    if (!tournamentId) {
      return ctx.answerCbQuery(
        "Turnir aniqlanmadi. /start link orqali kirganingizga ishonch hosil qiling."
      );
    }

    const data = await getTeamsByTournamentId(telegramId, tournamentId);
    const { tournament, teams } = data;

    if (!teams || teams.length === 0) {
      return ctx.editMessageText("Bu turnirda hozircha jamoalar mavjud emas.");
    }

    // Inline keyboard (faqat tugmalar ro‘yxati)
    const inline = teams.map((t) => [
      Markup.button.callback(
        `${t.name} (${t.players.length}/${tournament.playersPerTeam})`,
        `select_team_${t._id}`
      ),
    ]);

    // Orqaga tugmasi
    inline.push([Markup.button.callback("⬅️ Orqaga", "back_to_menu")]);

    await ctx.editMessageText(
      `👥 <b>${tournament.name}</b> — jamoani tanlang:`,
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard(inline).reply_markup,
      }
    );
  } catch (err) {
    console.error("show_teams error:", err);
    await ctx.reply("Jamoalarni olishda xatolik yuz berdi.");
  }
});

playerScene.action(/select_team_(.+)/, async (ctx) => {
  try {
    const teamId = ctx.match[1];
    const telegramId = String(ctx.from.id);
    const tournamentId = ctx.session.tournamentId;

    const username = ctx.from.username
      ? ctx.from.username.replace("@", "")
      : null;

    // Jamoani tekshiramiz — to'lganmi yo'qmi
    const data = await getTeamsByTournamentId(telegramId, tournamentId);
    const { tournament, teams } = data;
    const team = teams.find(t => String(t._id) === String(teamId));

    if (!team) {
      return ctx.reply("❌ Jamoa topilmadi.");
    }

    // Agar jamoa to'lgan bo‘lsa
    if (team.players.length >= tournament.playersPerTeam) {
      const inline = teams
        .filter(t => t.players.length < tournament.playersPerTeam) // faqat bo‘sh joyi bor jamoalar
        .map(t => [
          Markup.button.callback(
            `${t.name} (${t.players.length}/${tournament.playersPerTeam})`,
            `select_team_${t._id}`
          ),
        ]);
      inline.push([Markup.button.callback("⬅️ Orqaga", "back_to_menu")]);

      await ctx.replyWithHTML(
        `❌ <b>${team.name}</b> jamoasi to‘ldi.\n\nIltimos, boshqa jamoani tanlang:`,
        Markup.inlineKeyboard(inline)
      );
      return;
    }

    // Agar username mavjud bo‘lsa → darhol join
    if (username) {
      const res = await joinTournament(
        telegramId,
        tournamentId,
        teamId,
        username
      );

      if (res.success) {
        await ctx.answerCbQuery("✅ Jamoaga qo'shildingiz!");

        const updatedData = await getTeamsByTournamentId(telegramId, tournamentId);
        const { tournament, teams } = updatedData;

        const myTeam = teams.find((t) =>
          t?.players?.some((p) => String(p?.telegramId) === telegramId)
        );

        let msg = `<b>Siz muvaffaqqiyatli jamoaga qo'shildingiz!</b>\n\n`;
        msg += `Turnir: <b>${tournament.name}</b>\n`;
        msg += `Jamoa: <b>${myTeam.name}</b>\n`;
        msg += `Jamoada o'yinchilar: (${myTeam?.players?.length}/${tournament?.playersPerTeam})\n\n`;
        msg += `O'yinchilar ro'yxati:\n`;
        myTeam.players.forEach((p, i) => {
          msg += `${i + 1}. @${p.username || p.telegramId}\n`;
        });

        msg += `\nTurnirdagi jamoalar soni: ${tournament.teamCount}`;

        await ctx.replyWithHTML(msg);
        return ctx.scene.enter("player");
      } else {
        return ctx.reply(`❌ ${res.message || "Xatolik yuz berdi."}`);
      }
    }

    // Username yo‘q bo‘lsa → username kiritishni so‘raymiz
    ctx.session.selectTeamId = teamId;
    ctx.session.waitingForUsername = true;

    await ctx.answerCbQuery("Usernameingiz kerak");
    await ctx.reply("✍️ Iltimos, Telegram username'ingizni kiriting (masalan: @john)");
  } catch (err) {
    console.error("select_team error:", err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});


playerScene.action(/stats_tournament_(.+)/, async (ctx) => {
  // const tournamentId = ctx.match[1];
  const telegramId = String(ctx.from.id);
  const tournamentId = ctx.match[1]

  const res = await getMyStats(telegramId,tournamentId);

  if (!res.success) {
    return ctx.reply("📭 Sizda statistik ma'lumotlar mavjud emas.");
  }

  const stat = res.stats;

  const msg = `
<b>${res.player.tournament.name}</b> bo'yicha statistikangiz:

⚽️ Gollar: <b>${stat.goals}</b>
🎯 Assistlar: <b>${stat.assists}</b>
🎮 O'yinlar: <b>${stat.matchesPlayed}</b>
✅ G'alabalar: <b>${stat.wins}</b>
❌ Mag'lubiyatlar: <b>${stat.losses}</b>
  `;

  return ctx.replyWithHTML(msg);
});


playerScene.action(/matches_tournament_(.+)/, async (ctx) => {
  const tournamentId = ctx.match[1]
  const telegramId = String(ctx.from.id)

  const res = await getPlayerMatches(telegramId,tournamentId)

  if(!res.success || res.matches.length === 0){
    return ctx.reply("Ushbu turnirda o'yinlarda qatnashmagansiz.")
  }

  const matches = res.matches.filter(m => String(m.tournament._id) ===  String(tournamentId))
  if(matches.length === 0){
    return ctx.reply("Ushbu turnirda sizda o'yin yozilmagan.")
  }

  let msg = `<b>${matches[0].tournament.name}</b> - Siz ishtirok etgan o'yinlar:\n\n`

  matches.forEach(m => {
  const teamAPlayers = m.teamA.players.map(p => `@${p.username}`).join(", ");
  const teamBPlayers = m.teamB.players.map(p => `@${p.username}`).join(", ");

  msg += `\n<b>${m.teamA.name}</b> (${teamAPlayers})  vs  <b>${m.teamB.name}</b> (${teamBPlayers})`;
});


  return ctx.replyWithHTML(msg)
})

playerScene.on("text", async (ctx) => {
  const telegramId = String(ctx.from.id);

  // faqat natija kutilayotgan bo'lsa
  if (ctx.session.waitingForResult) {
    const matchId = ctx.session.selectedMatchId;
    const input = ctx.message.text.trim();

    const match = input.match(/(\d+)\s*-\s*(\d+)/);
    if(!match){
      return ctx.reply("❌ Natija formati noto'g'ri.\nMasalan: 3 - 2");
    }

    const scoreA = Number(match[1]);
    const scoreB = Number(match[2]);

    try {
      const res = await submitResult(telegramId, matchId, scoreA, scoreB);
      if(res.success){
        await ctx.reply("Natija yuborildi.\nAdmin tasdiqlashi kutilmoqda.");
      } else {
        await ctx.reply(`❌ ${res.message || "Xatolik yuz berdi."}`);
      }
    } catch(error){
      console.error(error);
      await ctx.reply("❌ Natija yuborishda xatolik yuz berdi.");
    }

    ctx.session.waitingForResult = false;
    ctx.session.selectedMatchId = null;
    return;
  }

  // username kiritish jarayoni
  if (ctx.session.waitingForUsername) {
    const usernameInput = ctx.message.text.replace("@", "").trim();
    const tournamentId = ctx.session.tournamentId;
    const teamId = ctx.session.selectTeamId;

    if (!teamId || !tournamentId) {
      ctx.session.waitingForUsername = false;
      ctx.session.selectTeamId = null;
      return ctx.reply("❌ Xatolik. Qayta urinib ko'ring.");
    }

    try {
      const res = await joinTournament(telegramId, tournamentId, teamId, usernameInput);
      if (res && res.success) {
        await ctx.reply("✅ Siz jamoaga qo'shildingiz!");

        // Shu yerda session-ni tozalash va qayta menyuga kirish
        ctx.session.waitingForUsername = false;
        ctx.session.selectTeamId = null;

        // Yangilangan jamoa va turnir ma'lumotlarini chiqarish
        const updatedData = await getTeamsByTournamentId(telegramId, tournamentId);
        const { tournament, teams } = updatedData;
        const myTeam = teams.find((t) =>
          t.players.some((p) => String(p.telegramId) === telegramId)
        );

        let msg = `<b>Siz muvaffaqqiyatli jamoaga qo'shildingiz!</b>\n\n`;
        msg += `Turnir: <b>${tournament.name}</b>\n`;
        msg += `Jamoa: <b>${myTeam.name}</b>\n`;
        msg += `Jamoada o'yinchilar: (${myTeam.players.length}/${tournament.playersPerTeam})\n\n`;
        msg += `O'yinchilar ro'yxati:\n`;
        myTeam.players.forEach((p, i) => {
          msg += `${i + 1}. @${p.username || usernameInput}\n`;
        });
        msg += `\nTurnirdagi jamoalar soni: ${tournament.teamCount}`;

        await ctx.replyWithHTML(msg);

        // menyuga qaytish
        return playerScene.enter(ctx);
 
      } else {
        await ctx.reply("❌ " + (res.message || "Xatolik yuz berdi."));
      }
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Xatolik yuz berdi.");
    }

    // sessionni tozalash
    ctx.session.waitingForUsername = false;
    ctx.session.selectTeamId = null;
    return;
  }
});


module.exports = { playerScene };
