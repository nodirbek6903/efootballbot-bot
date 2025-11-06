const { Scenes, Markup } = require("telegraf");
const {
  createTournament,
  getAdminTournaments,
  getTournamentDetails,
  getTeamsByTournamentId,
  getUserByTelegramId,
  startTournament,
  notifyPlayers,
  getPendingResults,
  approveResult,
  getPlayerStatsById,
  getGroupStandings
} = require("../helpers/api");

const adminScene = new Scenes.BaseScene("admin");

adminScene.enter(async (ctx) => {
  const telegramId = ctx.from.id;
  try {
    const userRes = await getUserByTelegramId(telegramId);
    const user = userRes.user || userRes;

    if (!user) return ctx.reply("Siz tizimda ro'yxatdan o'tmagansiz.");

    if (!user.isActive) {
      return ctx.replyWithHTML(
        `🚫 Siz faol emassiz!\n\nIltimos, superadmin bilan bog'laning: <b>@${process.env.SUPERADMIN_USERNAME}</b>`
      );
    }

    await ctx.reply(
      "Admin panelga xush kelibsiz 👇",
      Markup.keyboard([
        ["🏆 Turnir yaratish", "📋 Mening turnirlarim"],
        ["📝 Natijalarni tasdiqlash","O'yinchilar statistikasi"],["🏠 Bosh menyu"]
      ]).resize()
    );
  } catch (err) {
    console.error(
      "adminScene.enter xato:",
      err.response?.data || err.message || err
    );
    ctx.reply("Foydalanuvchi holatini tekshirishda xatolik yuz berdi.");
  }
});

let tempData = {};

adminScene.hears("🏆 Turnir yaratish", async (ctx) => {
  tempData[ctx.from.id] = {};
  await ctx.reply(
    "Turnir nomini kiriting:",
    Markup.keyboard([["Bekor qilish"]]).resize()
  );
  ctx.scene.session.step = "name";
});

adminScene.hears("Bekor qilish", (ctx) => {
  ctx.scene.session.step = null;
  tempData[ctx.from.id] = null;
  ctx.reply(
    "Jarayon bekor qilindi.",
    Markup.keyboard([
      ["🏆 Turnir yaratish"],
      ["📋 Mening turnirlarim"],
    ]).resize()
  );
});

// --- MENING TURNIRLARIM ---
adminScene.hears("📋 Mening turnirlarim", async (ctx) => {
  const telegramId = ctx.from.id;
  try {
    const tournaments = await getAdminTournaments(telegramId);

    if (!tournaments || tournaments.length === 0) {
      return ctx.reply("Sizda hali hech qanday turnir yaratilmagan.");
    }

    const buttons = tournaments.map((t) => [
      Markup.button.callback(`🏆 ${t.name}`, `tournament_${t._id}`),
    ]);

    await ctx.reply("Sizning turnirlaringiz:", Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error(
      "getAdminTournaments xato:",
      error.response?.data || error.message || error
    );
    ctx.reply("Turnirlarni olishda xatolik yuz berdi.");
  }
});

adminScene.hears("🏠 Bosh menyu", async (ctx) => {
  await ctx.scene.reenter();
});

adminScene.hears("📝 Natijalarni tasdiqlash", async (ctx) => {
  const telegramId = ctx.from.id;

  try {
    const res = await getPendingResults(telegramId);
    const results = res.results || [];

    if (results.length === 0) {
      return ctx.reply("Hozircha tasdiqlanadigan natija yo'q");
    }

    for (const r of results) {
      const teamA = r.teamA;
      const teamB = r.teamB;

      const statusEmoji = r.status === "pending" ? "⏳" : "⚠️";

      let msg =
        `${statusEmoji} <b>${teamA.name} vs ${teamB.name}</b>\n` +
        `Natija kiritgan: @${
          r.submittedBy.username || r.submittedBy.telegramId
        }\n` +
        `Score: ${r.scoreA} : ${r.scoreB}\n` +
        `Status: ${r.status}\n`;

      const buttons = []

      if(r.status === "conflict"){
        buttons.push([
          Markup.button.callback(
            `${teamA.name} natijasini tasdiqlash`,
            `approve_${r.match._id}_${r.scoreA}_${r.scoreB}`
          ),
          Markup.button.callback(
            `${teamB.name} natijasini tasdiqlash`,
            `approve_${r.match._id}_${r.scoreB}_${r.scoreA}`
          ),
        ])
      }else{
        // Pending bo‘lsa 1 ta tasdiqlash buttoni
        buttons.push([
          Markup.button.callback(
            `Natijani tasdiqlash`,
            `approve_${r.match._id}_${r.scoreA}_${r.scoreB}`
          ),
        ]);
      }
       buttons.push([Markup.button.callback("⬅️ Orqaga", "back_admin_menu")]);

      await ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
    }
  } catch (error) {
    console.error("getPendingResults xato:", error.response?.data || error.message || error);
    ctx.reply("Natijalarni olishda xatolik yuz berdi.");
  }
});
adminScene.hears("O'yinchilar statistikasi", async (ctx) => {
  const telegramId = ctx.from.id
  await ctx.reply("Malumotlar yuklanmoqda...")

  try {
    const res = getAdminTournaments(telegramId)
    const tournaments = res || []

    if(tournaments.length === 0){
      return ctx.reply("Sizda hali hech qanday turnir yo'q.")
    }

    for(const t of tournaments){
      const teamRes = await getTeamsByTournamentId(telegramId, t._id)
      const teams = teamRes.teams || []

      if(teams.length === 0) continue

      await ctx.replyWithHTML(`<b>${t.name}</b> O'yinchilar statistikasi:\n`)

      for(const team of teams){
        for(const p of team.players){
          try {
            const stats = await getPlayerStatsById(p._id)

            const st = stats.stats || {}
            const player = stats.player || {}

            const msg =
              `👤 <b>@${player.user?.username || player.user?.telegramId}</b>\n` +
              `🏆 <b>Jamoa:</b> ${player.team?.name || "Noma'lum"}\n` +
              `⚽️ Gollar: ${st.goals || 0}\n` +
              `🎯 Assistlar: ${st.assists || 0}\n` +
              `🏟 O'yinlar: ${st.matchesPlayed || 0}\n` +
              `✅ G'alabalar: ${st.wins || 0}\n` +
              `❌ Mag'lubiyatlar: ${st.losses || 0}\n`;

            await ctx.replyWithHTML(msg);
          } catch (error) {
            console.error("O'yinchi statistikasi olishda xato:", err.message);
          }
        }
      }
    }
    await ctx.reply("Statistikalar yakunlandi")
  } catch (error) {
    console.error("📈 Statistikani olishda xato:", error.response?.data || error.message);
    ctx.reply("❌ Statistikani olishda xatolik yuz berdi.");
  }
})

adminScene.action(/approve_(.+)_(.+)_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();

  const telegramId = ctx.from.id;
  const matchId = ctx.match[1];
  const scoreA = Number(ctx.match[2]);
  const scoreB = Number(ctx.match[3]);

  try {
    const res = await approveResult(telegramId, matchId, scoreA, scoreB);

    if (res.success) {
      await ctx.editMessageText("✅ Natija tasdiqlandi va jadval yangilandi!");
    } else {
      await ctx.reply("❌ Natija tasdiqlanmadi. Qayta urinib ko'ring.");
    }
  } catch (error) {
    console.error("approveResult xato:", error.response?.data || error.message);
    await ctx.reply("❌ Natijani tasdiqlashda xatolik yuz berdi.");
  }
});


// ℹ️ Turnir tafsilotlari
adminScene.action(/tournament_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const tournamentId = ctx.match[1];
  const telegramId = ctx.from.id;

  try {
    const res = await getTournamentDetails(telegramId, tournamentId);
    const t = res.data?.tournament || res.tournament;

    let statusText =
      t.status === "pending"
        ? "⏳ Kutilyapti"
        : t.status === "active"
        ? "🟢 Faol"
        : "🔴 Tugagan";

    const joinLink = `https://t.me/${process.env.BOT_USERNAME}?start=${t._id}`;

    await ctx.replyWithHTML(
      `<b>${t.name}</b>\n\n` +
        `👥 <b>Jamoalar soni:</b> ${t.teamCount}\n` +
        `🎯 <b>Har bir jamoada:</b> ${t.playersPerTeam} o'yinchi\n` +
        `📊 <b>Holat:</b> ${statusText}\n\n` +
        `🖇 <b>O'yinga qo'shilish havolasi:</b>\n${joinLink}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("👥 Jamoalarni ko'rish", `teams_${t._id}`)],
        [Markup.button.callback("📊 Jadvalni ko'rish", `standings_${t._id}`)],
        [Markup.button.callback("Xabar yuborish", `notify_${t._id}`)],
        [Markup.button.callback("⬅️ Orqaga", "back_admin_menu")],
      ])
    );
  } catch (error) {
    ctx.reply("Turnir tafsilotlarini olishda xatolik yuz berdi.");
  }
});

adminScene.action("back_admin_menu", async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.reenter();
});

// 👥 Jamoalar
adminScene.action(/teams_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const tournamentId = ctx.match[1];
  const telegramId = ctx.from.id;

  try {
    const res = await getTeamsByTournamentId(telegramId, tournamentId);
    const tournament = res.data?.tournament || res?.tournament;
    const teams = res?.teams || res?.data?.teams || [];

    // TURNIR TOLGANINI TEKSHIRISH
    const totalRequiredPlayers =
      tournament.teamCount * tournament.playersPerTeam;
    const totalJoinedPlayers = teams.reduce(
      (sum, team) => sum + team.players.length,
      0
    );
    const isFull = totalJoinedPlayers >= totalRequiredPlayers;

    let msg = `<b>${tournament.name}</b> jamoalari:\n\n`;

    teams.forEach((team, i) => {
      msg += `${i + 1}. <b>${team.name}</b> (${team.players.length}/${
        tournament.playersPerTeam
      })\n`;

      if (team.players.length > 0) {
        msg += `   O'yinchilar:\n`;
        team.players.forEach((p) => {
          msg += `     • @${p.username || p.telegramId}\n`;
        });
      } else {
        msg += `   Hali o'yinchi yo'q\n`;
      }

      msg += "\n";
    });

    msg += `👥 <b>Jami o'yinchilar:</b> ${totalJoinedPlayers}/${totalRequiredPlayers}\n\n`;

    if (isFull) {
      msg += `✅ <b>Turnir to'liq shakllandi!</b>\n`;
    } else {
      msg += `⏳ Jamoalar to'liq emas. Yana o'yinchi qo‘shilishi kutilmoqda.\n`;
    }

    const buttons = [
      [Markup.button.callback("⬅️ Orqaga", `tournament_${tournament._id}`)],
    ];

    // Agar turnir to'lgan bo'lsa START tugmasini qo'shamiz
    if (isFull) {
      buttons.unshift([
        Markup.button.callback(
          "▶️ Turnirni boshlash",
          `start_${tournament._id}`
        ),
      ]);
    }

    await ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
  } catch (error) {
    ctx.reply("Jamoalarni olishda xatolik yuz berdi.");
  }
});

adminScene.action(/start_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const tournamentId = ctx.match[1];
  const telegramId = ctx.from.id;

  try {
    const res = await startTournament(telegramId, tournamentId);

    let msg = `<b>Turnir boshlandi!</b>\n\n`;

    for (const groupName of Object.keys(res.groups)) {
      const group = res.groups[groupName];

      msg += `<b>Guruh ${groupName}</b>:\n`;

      // jamoalar va o'yinchilar
      group.teams.forEach((team) => {
        msg += `<b>${team?.name}</b>\n`;
        if (team.players.length > 0) {
          team.players.forEach((p) => {
            msg += `   • @${p.username || p.telegramId}\n`;
          });
        } else {
          msg += `   — Hali o'yinchi yo'q\n`;
        }
        msg += "\n";
      });

      msg += `\n<b>o'yinlar jadvali:</b>\n`;

      group?.matches?.forEach((match) => {
        msg += ` ${match.teamA.name}  vs ${match.teamB.name}\n`;
      });

      msg += `\n────────────────────\n\n`;
    }
    ctx.replyWithHTML(msg);
  } catch (error) {
    ctx.reply("Turnirni boshlashda xatolik yuz berdi.");
  }
});

adminScene.action(/notify_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const tournamentId = ctx.match[1];

  ctx.scene.session.notify = { tournamentId };

  await ctx.reply(
    "Yubormoqchi bo'lgan xabaringizni yozing...",
    Markup.keyboard([["Bekor qilish"]]).resize()
  );

  ctx.scene.session.step = "notify_message";
});

adminScene.action(/standings_(.+)/, async (ctx) => {
  await ctx.answerCbQuery()
  const tournamentId = ctx.match[1]
  const telegramId = ctx.from.id

  try {
    const res = await getGroupStandings(telegramId,tournamentId)
    const standings = res.standings || res.data || res
    if(!standings || Object.keys(standings).length === 0){
      return ctx.reply("Jadval topilmadi yoki hali o'yinlar o'tkizilmagan.")
    }

    let msg = `<b>Turnir jadvallari</b>\n\n`

    for(const [groupName,group] of Object.entries(standings)){
      msg += `<b>Guruh ${groupName}</b>\n`
      msg += "────────────────────\n";
      msg += `<b>Jamoa</b> | O | G | D | M | Ochko\n`


      group.forEach((team,i) => {
        msg += `${i+1}. ${team.teamName} | ${team.played} | ${team.wins} | ${team.draws} | ${team.losses} | ${team.points}\n`
      })

      msg += `\n`
    }

    await ctx.replyWithHTML(msg, Markup.inlineKeyboard([
      [Markup.button.callback("⬅️ Orqaga", `tournament_${tournamentId}`)]
    ]))
  } catch (error) {
    console.error("getGroupStandings xato:", error.response?.data || error.message || error);
    ctx.reply("❌ Jadvalni olishda xatolik yuz berdi.");
  }
})

adminScene.on("text", async (ctx) => {
  const step = ctx.scene.session.step;
  const telegramId = ctx.from.id;
  const text = ctx.message.text;
  if (!step) return;

  if (step === "name") {
    tempData[telegramId].name = text;
    await ctx.reply("Turnirda nechta jamoa bo'ladi?");
    ctx.scene.session.step = "teamCount";
  } else if (step === "teamCount") {
    const count = Number(text);
    if (isNaN(count) || count <= 0)
      return ctx.reply("❌ Raqam kiriting (masalan: 8)");
    tempData[telegramId].teamCount = count;
    await ctx.reply("Har bir jamoada nechta o'yinchi bo'ladi?");
    ctx.scene.session.step = "playersPerTeam";
  } else if (step === "playersPerTeam") {
    const players = Number(text);
    if (isNaN(players) || players <= 0)
      return ctx.reply("❌ Raqam kiriting (masalan: 5)");
    tempData[telegramId].playersPerTeam = players;

    try {
      const res = await createTournament(telegramId, tempData[telegramId]);
      // createTournament helper returns res.data from backend
      const tournament = res.tournament || res.data?.tournament;
      if (!tournament) {
        console.log("createTournament API javobi:", res);
        return ctx.reply("❌ Turnir yaratildi, ammo ma'lumot qaytmadi.");
      }

      const link = `https://t.me/${process.env.BOT_USERNAME}?start=${tournament._id}`;
      await ctx.replyWithHTML(
        `✅ <b>Turnir yaratildi!</b>\n\n` +
          `🏆 <b>Turnir nomi:</b> ${tournament.name}\n` +
          `👥 <b>Jamoalar soni:</b> ${tournament.teamCount}\n` +
          `🎯 <b>Har bir jamoada:</b> ${tournament.playersPerTeam} o'yinchi\n\n` +
          `🔗 <b>Qo'shilish havolasi:</b>\n${link}`
      );

      await ctx.reply(
        "Asosiy menyu:",
        Markup.keyboard([["📋 Mening turnirlarim"], ["🏠 Bosh menyu"]]).resize()
      );
    } catch (error) {
      console.error(
        "Turnir yaratishda xato:",
        error.response?.data || error.message || error
      );
      ctx.reply("❌ Turnir yaratishda xatolik yuz berdi!");
    }

    tempData[telegramId] = null;
    ctx.scene.session.step = null;
  } else if (step === "notify_message") {
    const { tournamentId } = ctx.scene.session.notify || {};
    const message = text;
    const telegramId = ctx.from.id;

    if (!tournamentId) {
      return ctx.reply("Turnir aniqlanmadi, qayta urinib ko'ring.");
    }

    try {
      const res = await notifyPlayers(telegramId, tournamentId, message);
      if (res.success) {
        await ctx.reply("Xabar barcha o'yinchilarga yuborildi!");
      } else {
        await ctx.reply("Xabar yuborilmadi. Iltimos, qayta urinib ko'ring");
      }
    } catch (error) {
      console.error(
        "notifyPlayers xato:",
        error.response?.data || error.message || error
      );
      await ctx.reply("❌ Xabar yuborishda xatolik yuz berdi.");
    }
    ctx.scene.session.step = null;
    ctx.scene.session.notify = null;
    await ctx.reply(
      "Admin menyu:",
      Markup.keyboard([
        ["🏆 Turnir yaratish", "📋 Mening turnirlarim"],
        ["🏠 Bosh menyu"],
      ]).resize()
    );
  }
});

module.exports = { adminScene };
