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

export async function fetchRecentGames(teamId: number, limit = 5, year = 2024, seasonTypeId?: number) {
  let url = `${API_URL}/teams/${teamId}/recent_games?limit=${limit}&year=${year}`;
  if (seasonTypeId) url += `&season_type_id=${seasonTypeId}`;
  const response = await fetch(url);
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
        let teamsObj: any[] = [];
        try {
            const coreRes = await fetch(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${season}/athletes/${playerId}?lang=en&region=us`);
            if (coreRes.ok) {
                const coreData = await coreRes.json();
                let teamRefs = [];
                if (coreData.teams && coreData.teams.length > 0) {
                    teamRefs = coreData.teams;
                } else if (coreData.team && coreData.team["$ref"]) {
                    teamRefs = [coreData.team];
                }

                if (teamRefs.length > 0) {
                    // They might have played for multiple teams. Fetch the abbreviation and ID for each ref.
                    const teamPromises = teamRefs.map(async (t: any) => {
                        const tRes = await fetch(t["$ref"].replace("http://", "https://"));
                        if (tRes.ok) {
                            const tData = await tRes.json();
                            return { id: tData.id, abbrev: tData.abbreviation };
                        }
                        return null;
                    });
                    const resolvedTeams = await Promise.all(teamPromises);
                    const validTeams = resolvedTeams.filter(Boolean);
                    if (validTeams.length > 0) {
                        teamAbbrev = validTeams.map(t => t.abbrev).join("/");
                        teamsObj = validTeams;
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to resolve core team for ${season}`, e);
        }

        return {
            season,
            team: teamAbbrev,
            teamsObj,
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



export async function fetchPlayerGameLogs(playerId: number, year: number, limit: number = 20, seasonTypeId?: number) {
  let url = `${API_URL}/players/${playerId}/gamelog?year=${year}&limit=${limit}`;
  if (seasonTypeId) url += `&season_type_id=${seasonTypeId}`;
  const response = await fetch(url);
  if (!response.ok) return { batting: [], pitching: [] };
  return await response.json();
}

export async function fetchPlayerPropsAvailable(playerId: number) {
  const response = await fetch(`${API_URL}/players/${playerId}/props`);
  if (!response.ok) return [];
  return await response.json();
}

export async function fetchLeagueLeaders(year: number = new Date().getFullYear()) {
  try {
    // Determine the active season from our local DB, otherwise fallback
    const res = await fetch(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${year}/types/2/leaders?lang=en&region=us`);
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!data.categories) return [];
    
    // We only need a select few categories, but let's grab them and resolve the athlete/team details
    const processedCategories = await Promise.all(data.categories.map(async (cat: any) => {
        // Grab top 5 leaders per category
        const topLeaders = cat.leaders.slice(0, 5);
        
        const resolvedLeaders = await Promise.all(topLeaders.map(async (leader: any) => {
            // Fetch Athlete details
            let id = "0";
            let name = "Unknown";
            let headshot = "https://a.espncdn.com/i/headshots/nophoto.png";
            let teamId = "mlb";
            let teamColor = "00193c";
            
            try {
                if (leader.athlete && leader.athlete["$ref"]) {
                    const athRes = await fetch(leader.athlete["$ref"].replace("http://", "https://"));
                    if (athRes.ok) {
                        const athData = await athRes.json();
                        id = athData.id;
                        name = athData.shortName || athData.displayName || athData.fullName;
                        headshot = athData.headshot?.href || headshot;
                    }
                }
                
                if (leader.team && leader.team["$ref"]) {
                    const teamRes = await fetch(leader.team["$ref"].replace("http://", "https://"));
                    if (teamRes.ok) {
                        const teamData = await teamRes.json();
                        teamId = teamData.id;
                        teamColor = teamData.color || teamColor;
                    }
                }
            } catch(e) {
                console.error("Failed resolving leader detail", e);
            }
            
            return {
                id,
                value: leader.value,
                name,
                headshot,
                teamId,
                teamColor
            };
        }));
        
        return {
            name: cat.name,
            displayName: cat.displayName,
            leaders: resolvedLeaders
        };
    }));
    
    return processedCategories.filter(Boolean);
  } catch(e) {
    console.error(e);
    return [];
  }
}


export async function fetchLeagueAggregatedStats(year: number, type: "batting" | "pitching", seasonType: string = "Regular Season", limit: number = 100) {
    const res = await fetch(`${API_URL}/stats/league?year=${year}&type=${type}&season_type=${encodeURIComponent(seasonType)}&limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
}


export async function fetchLiveEspnLeaders(year: number = 2026, category: string = "avg", limit: number = 100) {
    try {
        const res = await fetch(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${year}/types/2/leaders?limit=${limit}`);
        if (!res.ok) return [];
        
        const data = await res.json();
        if (!data.categories) return [];
        
        const targetCategory = data.categories.find((c: any) => c.name === category);
        if (!targetCategory || !targetCategory.leaders) return [];
        
        const resolvedLeaders = await Promise.all(targetCategory.leaders.map(async (leader: any) => {
            let id = "0";
            let name = "Unknown";
            let headshot = "https://a.espncdn.com/i/headshots/nophoto.png";
            let teamId = "mlb";
            let teamAbbrev = "MLB";
            let teamColor = "00193c";
            
            try {
                if (leader.athlete && leader.athlete["$ref"]) {
                    const athRes = await fetch(leader.athlete["$ref"].replace("http://", "https://"));
                    if (athRes.ok) {
                        const athData = await athRes.json();
                        id = athData.id;
                        name = athData.shortName || athData.displayName || athData.fullName;
                        headshot = athData.headshot?.href || headshot;
                    }
                }
                
                if (leader.team && leader.team["$ref"]) {
                    const teamRes = await fetch(leader.team["$ref"].replace("http://", "https://"));
                    if (teamRes.ok) {
                        const teamData = await teamRes.json();
                        teamId = teamData.id;
                        teamAbbrev = teamData.abbreviation;
                        teamColor = teamData.color || teamColor;
                    }
                }
            } catch(e) {
                console.error("Failed resolving leader detail", e);
            }
            
            return {
                athlete_id: id,
                name,
                headshot,
                team_id: teamId,
                team_abbrev: teamAbbrev,
                team_color: teamColor,
                displayValue: leader.displayValue,
                value: leader.value
            };
        }));
        
        return resolvedLeaders;
    } catch(e) {
        console.error(e);
        return [];
    }
}


export async function fetchLiveEspnStatistics(year: number = 2026, sortCategory: string = "OPS", sortDirection: "asc" | "desc" = "desc", view: "batting" | "pitching" = "batting", limit: number = 100) {
    try {
        // ESPN uses specific sort keys for this endpoint
        const sortParam = `${view}.${sortCategory}:${sortDirection}`;
        
        // seasontype=2 is Regular Season. 
        // We will default to Regular Season for this massive table to match ESPN exactly.
        const res = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/statistics/byathlete?season=${year}&limit=${limit}&sort=${sortParam}&seasontype=2`);
        if (!res.ok) return [];
        
        const data = await res.json();
        if (!data.athletes) return [];
        
        // Grab the category index structure from the root payload
        const rootBatting = data.categories?.find((c: any) => c.name === "batting");
        const rootPitching = data.categories?.find((c: any) => c.name === "pitching");
        
        const batNames = rootBatting?.names || [];
        const pitchNames = rootPitching?.names || [];

        const resolvedPlayers = data.athletes.map((item: any) => {
            const ath = item.athlete;
            
            // Extract the player's stat categories
            const pBat = item.categories?.find((c: any) => c.name === "batting");
            const pPitch = item.categories?.find((c: any) => c.name === "pitching");
            
            // Zip the arrays into objects
            const batStats: any = {};
            if (pBat && pBat.values) {
                batNames.forEach((name: string, i: number) => {
                    batStats[name] = pBat.values[i];
                });
            }
            
            const pitchStats: any = {};
            if (pPitch && pPitch.values) {
                pitchNames.forEach((name: string, i: number) => {
                    pitchStats[name] = pPitch.values[i];
                });
            }

            return {
                athlete_id: ath.id,
                name: ath.shortName || ath.displayName,
                headshot: ath.headshot?.href || `https://a.espncdn.com/i/headshots/nophoto.png`,
                team_id: ath.teamId || "mlb",
                team_abbrev: ath.teamShortName || "MLB",
                team_color: ath.teamColor || "00193c",
                batting: batStats,
                pitching: pitchStats
            };
        });
        
        // Filter out players who don't have relevant stats based on the view
        return resolvedPlayers.filter((p: any) => {
            if (view === "batting") return p.batting?.atBats !== null && p.batting?.atBats !== undefined;
            return p.pitching?.innings !== null && p.pitching?.innings !== undefined;
        });
    } catch(e) {
        console.error("Failed to fetch ESPN aggregate stats", e);
        return [];
    }
}


export async function fetchGameSummary(gameId: string) {
    try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`);
        if (!res.ok) return null;
        return await res.json();
    } catch(e) {
        console.error("Failed to fetch game summary", e);
        return null;
    }
}

export async function fetchPropBets(gameId: string) {
    try {
        const res = await fetch(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/events/${gameId}/competitions/${gameId}/odds/100/propBets?lang=en&region=us&limit=1000`);
        if (!res.ok) return null;
        return await res.json();
    } catch(e) {
        console.error("Failed to fetch prop bets", e);
        return null;
    }
}
export async function fetchSavedProps(date: string, eventIds?: string[]) {
    let url = `${API_URL}/props/${date}`;
    if (eventIds && eventIds.length > 0) {
        url += `?event_ids=${eventIds.join(',')}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}
