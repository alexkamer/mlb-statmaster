const API_URL = "http://localhost:8000/api";

export async function fetchTeams(year = 2024) {
  const response = await fetch(`${API_URL}/teams?year=${year}`);
  return response.json();
}

export async function fetchTeamStats(teamId: number, year = 2024, seasonType = "All") {
  const response = await fetch(`${API_URL}/teams/${teamId}/stats?year=${year}&season_type=${encodeURIComponent(seasonType)}`);
  return response.json();
}

export async function fetchTeamRoster(teamId: number, year = 2024, seasonType = "All") {
  const response = await fetch(`${API_URL}/teams/${teamId}/roster?year=${year}&season_type=${encodeURIComponent(seasonType)}`);
  return response.json();
}

export async function fetchRecentGames(teamId: number, limit = 5) {
  const response = await fetch(`${API_URL}/teams/${teamId}/recent_games?limit=${limit}`);
  return response.json();
}export async function fetchPaginatedTeamGames(teamId: number, year = 2024, page = 1, limit = 20, seasonType = "All") {
  const response = await fetch(`${API_URL}/teams/${teamId}/games?year=${year}&page=${page}&limit=${limit}&season_type=${encodeURIComponent(seasonType)}`);
  return response.json();
}

export async function fetchAllGames(year = 2024, page = 1, limit = 50, seasonType = "All") {
  const response = await fetch(`${API_URL}/games?year=${year}&page=${page}&limit=${limit}&season_type=${encodeURIComponent(seasonType)}`);
  return response.json();
}
export async function fetchLiveTeamRoster(teamId: number) {
  const response = await fetch(`${API_URL}/teams/${teamId}/live_roster`);
  return response.json();
}
export async function fetchSeasons() {
  const response = await fetch(`${API_URL}/seasons`);
  return response.json();
}
export async function fetchTeamPitchingStats(teamId: number, year = 2024, seasonType = "All") {
  const response = await fetch(`${API_URL}/teams/${teamId}/roster/pitching?year=${year}&season_type=${encodeURIComponent(seasonType)}`);
  return response.json();
}
