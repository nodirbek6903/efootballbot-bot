const formatTournament = (t) => {
    return `🏆 *${t.name}*\nTeams: ${t.teamCount}\nPlayers/team: ${t.playersPerTeam}\nStatus: ${t.status}`
}

module.exports = formatTournament