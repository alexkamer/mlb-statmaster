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
  try {
      const response = await fetch(`${API_URL}/players/${playerId}`);
      if (!response.ok) return {};
      return await response.json();
  } catch(e) {
      console.error("Backend fetch error:", e);
      return {};
  }
}

export async function fetchEspnSplits(playerId: number, category?: string) {
  // 1. Initial fetch to get filters and available seasons
  const baseParams = category ? `?category=${category}` : "";
  const baseRes = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${playerId}/splits${baseParams}`);
  
  if (!baseRes.ok) {
    if (baseRes.status === 404) throw new Error("Splits not found");
    throw new Error("Failed to fetch splits");
  }
  
  const baseData = await baseRes.json();
  
  // Extract configuration from filters
  const seasonFilter = baseData.filters.find((f: any) => f.name === "season");
  const categoryFilter = baseData.filters.find((f: any) => f.name === "category");
  
  if (!seasonFilter) return { seasons: [], labels: [], activeCategory: null, availableCategories: [] };
  
  const availableSeasons = seasonFilter.options.map((o: any) => o.value);
  const activeCategory = categoryFilter?.value || "batting";
  const availableCategories = categoryFilter?.options.map((o: any) => o.value) || [];

  // Determine standard labels from the base response (current year)
  let baseLabels = baseData.labels || [];
  let baseNames = baseData.names || [];

  // We want to fetch the "split" -> "Overall" row for EVERY season concurrently
  const seasonPromises = availableSeasons.map(async (season: string) => {
      try {
        const res = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${playerId}/splits?season=${season}&category=${activeCategory}`);
        if (!res.ok) return null;
        const data = await res.json();
        
        // Find the "split" category which contains the "Overall" summary for that year
        const splitCat = data.splitCategories?.find((cat: any) => cat.name === "split" || cat.name === "general");
        if (!splitCat) return null;
        
        const overallSplit = splitCat.splits?.find((s: any) => s.displayName === "All Splits" || s.displayName === "Overall" || s.abbreviation === "ALL");
        if (!overallSplit) return null;
        
        // Fetch the empirical list of teams they played for in this specific season via Core API
        let teamAbbrev = "MLB";
        try {
            const coreRes = await fetch(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${season}/athletes/${playerId}?lang=en&region=us`);
            if (coreRes.ok) {
                const coreData = await coreRes.json();
                if (coreData.teams && coreData.teams.length > 0) {
                    // They might have played for multiple teams. Fetch the abbreviation for each ref.
                    const teamPromises = coreData.teams.map(async (t: any) => {
                        const tRes = await fetch(t["$ref"].replace("http://", "https://"));
                        if (tRes.ok) {
                            const tData = await tRes.json();
                            return tData.abbreviation;
                        }
                        return null;
                    });
                    const resolvedTeams = await Promise.all(teamPromises);
                    const validTeams = resolvedTeams.filter(Boolean);
                    if (validTeams.length > 0) {
                        teamAbbrev = validTeams.join("/");
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to resolve core team for ${season}`, e);
        }

        return {
            season,
            team: teamAbbrev,
            stats: overallSplit.stats
        };
      } catch (e) {
          return null;
      }
  });

  const seasonResults = await Promise.all(seasonPromises);
  const validSeasons = seasonResults.filter(r => r !== null);

  return {
      activeCategory,
      availableCategories,
      labels: baseLabels,
      names: baseNames,
      seasons: validSeasons
  };
}

