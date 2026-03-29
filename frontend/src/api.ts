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
export async function fetchTeamEspnData(teamId: number) {
  const response = await fetch(`${API_URL}/teams/${teamId}/espn_data`);
  if (!response.ok) return {};
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}
export async function fetchTeamDepthChart(teamId: number) {
  const response = await fetch(`${API_URL}/teams/${teamId}/depthchart`);
  if (!response.ok) return {};
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}
export async function fetchTeamLeaders(teamId: number, year = 2024, seasonType = "All") {
  const response = await fetch(`${API_URL}/teams/${teamId}/leaders?year=${year}&season_type=${encodeURIComponent(seasonType)}`);
  if (!response.ok) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}
export async function fetchTeamStanding(teamId: number, year = 2024) {
  const response = await fetch(`${API_URL}/teams/${teamId}/standing?year=${year}`);
  if (!response.ok) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}


export async function fetchPlayerProfile(playerId: number) {
  const response = await fetch(`${API_URL}/players/${playerId}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error("Player not found");
    throw new Error("Failed to fetch player profile");
  }
  return response.json();
}

