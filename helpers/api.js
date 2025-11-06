require("dotenv").config()
const axios = require("axios");

const api = axios.create({
  baseURL: process.env.BACKEND_URI,
  headers: { "Content-Type": "application/json" },
});

console.log("backend url:" , process.env.BACKEND_URI)

// Telegram ID headerini qo‘shish uchun qulay funksiya
const authHeader = (telegramId) => ({
  headers: { "x-telegram-id": String(telegramId) },
});
 
// --- AUTH ---
const registerUser = async (telegramId, username, inviteToken) => {
  const res = await api.post("/auth/register", { telegramId, username, inviteToken });
  return res.data;
};

// --- ADMIN ---
const createAdminInvite = async (telegramId) => {
  const res = await api.post("/admin/create-invite", {}, authHeader(telegramId));  
  return res.data;
};

const getAdminList = async (telegramId) => {
  const res = await api.get("/admin/list", authHeader(telegramId)); 
  return { admins: res.data };
};

const toggleAdminStatus = async (telegramId, adminId) => {
  const res = await api.patch(`/admin/${adminId}/toggle`, {}, authHeader(telegramId));
  return res.data;
};

const getUserByTelegramId = async (telegramId) => {
  const res = await api.get(`/admin/${telegramId}`, authHeader(telegramId));
  return res.data;
};

// --- TOURNAMENT ---
const createTournament = async (telegramId, body) => {
  const res = await api.post("/tournament/create", body, authHeader(telegramId));
  return res.data;
};

const getAdminTournaments = async (telegramId) => {
  const res = await api.get("/tournament/my", authHeader(telegramId));
  return res.data.tournaments || [];
};

const getTournamentDetails = async (telegramId, id) => {
  const res = await api.get(`/tournament/details/${id}`, authHeader(telegramId));
  return res.data;
};

const startTournament = async (telegramId, id) => {
  const res = await api.post(`/tournament/${id}/start`, {}, authHeader(telegramId));
  return res.data;
};

const notifyPlayers = async (telegramId, id, message) => {
  const res = await api.post(`/tournament/${id}/notify`, { message }, authHeader(telegramId));
  return res.data;
};

// --- TEAMS / PLAYERS ---
const getTeamsByTournamentId = async (telegramId, id) => {
  const res = await api.get(`/team/${id}`, authHeader(telegramId));
  return res.data;
};

const joinTournament = async (telegramId, tournamentId, teamId, username) => {
  const res = await api.post(
    "/player/join",
    { telegramId, tournamentId, teamId, username },
    authHeader(telegramId)
  );
  return res.data;
};

const getMyTournaments = async (telegramId) => {
  const res = await api.get(`/player/${telegramId}/tournaments`, authHeader(telegramId));
  return res.data;
};

const getPlayerStatsById = async (telegramId,id) => {
  const res = await api.get(`/player/stats/player/${id}`,authHeader(telegramId));
  return res.data;
};

const getMyStats = async (telegramId,tournamentId) => {
  const res = await api.get(`/player/stats/my/${telegramId}/${tournamentId}`, authHeader(telegramId));
  return res.data;
};

const getPlayerMatches = async (telegramId, tournamentId) => {
  const res = await api.get("/match/my-matches", {
    params: { tournamentId },
    ...authHeader(telegramId),
  });
  return res.data;
};

// --- MATCH RESULTS ---
const submitResult = async (telegramId, matchId, scoreA, scoreB) => {
  const res = await api.post(
    `/match/${matchId}/result`,
    { scoreA, scoreB },
    authHeader(telegramId)
  );
  return res.data;
};

const getPendingResults = async (telegramId) => {
  const res = await api.get("/match/pending", authHeader(telegramId));
  return res.data;
};

const approveResult = async (telegramId, matchId, scoreA, scoreB) => {
  const res = await api.post(
    `/match/${matchId}/approve`,
    { scoreA, scoreB },
    authHeader(telegramId)
  );
  return res.data;
};

const getGroupStandings = async (telegramId, tournamentId) => {
  const res = await api.get(`/match/standings/${tournamentId}`, authHeader(telegramId));
  return res.data;
};

module.exports = {
  api,
  registerUser,
  createAdminInvite,
  getAdminList,
  toggleAdminStatus,
  getUserByTelegramId,
  createTournament,
  getAdminTournaments,
  getTournamentDetails,
  startTournament,
  getTeamsByTournamentId,
  joinTournament,
  getMyTournaments,
  getPlayerStatsById,
  getMyStats,
  getPlayerMatches,
  notifyPlayers,
  submitResult,
  getPendingResults,
  approveResult,
  getGroupStandings,
};
