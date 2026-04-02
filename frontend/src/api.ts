export const API_URL = "http://localhost:8000/api";

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchWithCache(url: string) {
  const now = Date.now();
  if (cache.has(url)) {
    const cached = cache.get(url)!;
    if (now - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  
  cache.set(url, { data, timestamp: now });
  return data;
}

export async function fetchTeams(year = new Date().getFullYear()) {
  return fetchWithCache(`${API_URL}/teams?year=${year}`);
}

export async function fetchTeamStats(teamId: number, year = new Date().getFullYear(), seasonType = "All") {
  return fetchWithCache(`${API_URL}/teams/${teamId}/stats?year=${year}&season_type=${encodeURIComponent(seasonType)}`);
}

export async function fetchTeamRoster(teamId: number, year = new Date().getFullYear(), seasonType = "All") {
  return fetchWithCache(`${API_URL}/teams/${teamId}/roster?year=${year}&season_type=${encodeURIComponent(seasonType)}`);
}

export async function fetchRecentGames(teamId: number, limit = 5, year = new Date().getFullYear(), seasonTypeId?: number) {
  let url = `${API_URL}/teams/${teamId}/recent_games?limit=${limit}&year=${year}`;
  if (seasonTypeId) url += `&season_type_id=${seasonTypeId}`;
  return fetchWithCache(url);
}export async function fetchPaginatedTeamGames(teamId: number, year = new Date().getFullYear(), page = 1, limit = 20, seasonType = "All") {
  return fetchWithCache(`${API_URL}/teams/${teamId}/games?year=${year}&page=${page}&limit=${limit}&season_type=${encodeURIComponent(seasonType)}`);
}

export async function fetchAllGames(year = new Date().getFullYear(), page = 1, limit = 50, seasonType = "All") {
  return fetchWithCache(`${API_URL}/games?year=${year}&page=${page}&limit=${limit}&season_type=${encodeURIComponent(seasonType)}`);
}
export async function fetchLiveTeamRoster(teamId: number) {
  return fetchWithCache(`${API_URL}/teams/${teamId}/live_roster`);
}
export async function fetchSeasons() {
  return fetchWithCache(`${API_URL}/seasons`);
}
export async function fetchTeamPitchingStats(teamId: number, year = new Date().getFullYear(), seasonType = "All") {
  return fetchWithCache(`${API_URL}/teams/${teamId}/roster/pitching?year=${year}&season_type=${encodeURIComponent(seasonType)}`);
}
export async function fetchTeamEspnData(teamId: number) {
  try {
    return await fetchWithCache(`${API_URL}/teams/${teamId}/espn_data`);
  } catch {
    return {};
  }
}
export async function fetchTeamDepthChart(teamId: number) {
  try {
    return await fetchWithCache(`${API_URL}/teams/${teamId}/depthchart`);
  } catch {
    return {};
  }
}
export async function fetchTeamLeaders(teamId: number, year = new Date().getFullYear(), seasonType = "All") {
  try {
    return await fetchWithCache(`${API_URL}/teams/${teamId}/leaders?year=${year}&season_type=${encodeURIComponent(seasonType)}`);
  } catch {
    return [];
  }
}
export async function fetchTeamStanding(teamId: number, year = new Date().getFullYear()) {
  try {
    return await fetchWithCache(`${API_URL}/teams/${teamId}/standing?year=${year}`);
  } catch {
    return null;
  }
}

export async function fetchPlayerProfile(playerId: number) {
  try {
      return await fetchWithCache(`${API_URL}/players/${playerId}`);
  } catch(e) {
      console.error("Backend fetch error:", e);
      return {};
  }
}

export async function fetchEspnSplits(playerId: number, category?: string) {
  // 1. Initial fetch to get filters and available seasons
  const baseParams = category ? `?category=${category}` : "";
  let baseData;
  try {
      baseData = await fetchWithCache(`https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${playerId}/splits${baseParams}`);
  } catch (e) {
      throw new Error("Failed to fetch splits");
  }
  
  if (!baseData || !baseData.filters) return { seasons: [], labels: [], activeCategory: null, availableCategories: [] };

  
  // Extract configuration from filters
  const seasonFilter = baseData.filters.find((f: any) => f.name === "season");
  const categoryFilter = baseData.filters.find((f: any) => f.name === "category");
  
  if (!seasonFilter) return { seasons: [], labels: [], activeCategory: null, availableCategories: [] };
  
  const availableSeasons = seasonFilter.options.map((o: any) => o.value);
  const activeCategory = category || categoryFilter?.value || "batting";
  const availableCategories = categoryFilter?.options.map((o: any) => o.value) || [];

  // Determine standard labels from the base response (current year)
  let baseLabels = baseData.labels || [];
  let baseNames = baseData.names || [];
  let baseDisplayNames = baseData.displayNames || [];
  let baseDescriptions = baseData.descriptions || [];

  // We want to fetch the "split" -> "Overall" row for EVERY season concurrently
  const seasonPromises = availableSeasons.map(async (season: string) => {
      try {
        const data = await fetchWithCache(`https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${playerId}/splits?season=${season}&category=${activeCategory}`);
        if (!data) return null;
        
        // Find the "split" category which contains the "Overall" summary for that year
        const splitCat = data.splitCategories?.find((cat: any) => cat.name === "split" || cat.name === "general");
        if (!splitCat) return null;
        
        const overallSplit = splitCat.splits?.find((s: any) => s.displayName === "All Splits" || s.displayName === "Overall" || s.abbreviation === "ALL");
        if (!overallSplit) return null;
        
        // Fetch the empirical list of teams they played for in this specific season via Core API
        let teamAbbrev = "MLB";
        let teamsObj: any[] = [];
        try {
            const coreData = await fetchWithCache(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${season}/athletes/${playerId}?lang=en&region=us`);
            if (coreData) {
                let teamRefs: any[] = [];
                if (coreData.teams && coreData.teams.length > 0) {
                    teamRefs = coreData.teams;
                } else if (coreData.team && coreData.team["$ref"]) {
                    teamRefs = [coreData.team];
                }

                if (teamRefs.length > 0) {
                    // They might have played for multiple teams. Fetch the abbreviation and ID for each ref.
                    const teamPromises = teamRefs.map(async (t: any) => {
                        try {
                            const tData = await fetchWithCache(t["$ref"].replace("http://", "https://"));
                            if (tData) {
                                return { id: tData.id, abbrev: tData.abbreviation };
                            }
                        } catch (e) {}
                        return null;
                    });
                    const resolvedTeams = await Promise.all(teamPromises);
                    const validTeams = resolvedTeams.filter(Boolean);
                    if (validTeams.length > 0) {
                        teamAbbrev = validTeams.map((t: any) => t.abbrev).join("/");
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
      displayNames: baseDisplayNames,
      descriptions: baseDescriptions,
      seasons: validSeasons
  };
}



export async function fetchPlayerGameLogs(playerId: number, year: number, limit: number = 20, seasonTypeId?: number) {
  let url = `${API_URL}/players/${playerId}/gamelog?year=${year}&limit=${limit}`;
  if (seasonTypeId) url += `&season_type_id=${seasonTypeId}`;
  return await fetchWithCache(url);
  
  
}

export async function fetchPlayerPropsAvailable(playerId: number) {
  return await fetchWithCache(`${API_URL}/players/${playerId}/props`);
  
  
}

export async function fetchLeagueLeaders(year: number = new Date().getFullYear()) {
  try {
    const data = await fetchWithCache(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${year}/types/2/leaders?lang=en&region=us`);
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
                    const athData = await fetchWithCache(leader.athlete["$ref"].replace("http://", "https://"));
                    id = athData.id;
                    name = athData.shortName || athData.displayName || athData.fullName;
                    headshot = athData.headshot?.href || headshot;
                }
                
                if (leader.team && leader.team["$ref"]) {
                    const teamData = await fetchWithCache(leader.team["$ref"].replace("http://", "https://"));
                    teamId = teamData.id;
                    teamColor = teamData.color || teamColor;
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
    return await fetchWithCache(`${API_URL}/stats/league?year=${year}&type=${type}&season_type=${encodeURIComponent(seasonType)}&limit=${limit}`);
    
    
}


export async function fetchLiveEspnLeaders(year: number = new Date().getFullYear(), category: string = "avg", limit: number = 100) {
    try {
        const data = await fetchWithCache(`https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/${year}/types/2/leaders?limit=${limit}`);
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
                    const athData = await fetchWithCache(leader.athlete["$ref"].replace("http://", "https://"));
                    id = athData.id;
                    name = athData.shortName || athData.displayName || athData.fullName;
                    headshot = athData.headshot?.href || headshot;
                }
                
                if (leader.team && leader.team["$ref"]) {
                    const teamData = await fetchWithCache(leader.team["$ref"].replace("http://", "https://"));
                    teamId = teamData.id;
                    teamAbbrev = teamData.abbreviation;
                    teamColor = teamData.color || teamColor;
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


export async function fetchLiveEspnStatistics(year: number = new Date().getFullYear(), sortCategory: string = "OPS", sortDirection: "asc" | "desc" = "desc", view: "batting" | "pitching" = "batting", limit: number = 100) {
    try {
        // ESPN uses specific sort keys for this endpoint
        const sortParam = `${view}.${sortCategory}:${sortDirection}`;
        
        // seasontype=2 is Regular Season. 
        // We will default to Regular Season for this massive table to match ESPN exactly.
        const data = await fetchWithCache(`https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/statistics/byathlete?season=${year}&limit=${limit}&sort=${sortParam}&seasontype=2`);
        if (!data || !data.athletes) return [];
        
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
        return await fetchWithCache(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`);
        
        
    } catch(e) {
        console.error("Failed to fetch game summary", e);
        return null;
    }
}

export async function fetchPropBets(gameId: string) {
    try {
        // Proxy through our backend to prevent Chrome from natively logging 404 errors to the console
        const response = await fetchWithCache(`${API_URL}/games/${gameId}/props`);
        return response;
    } catch(e) {
        return null;
    }
}
export async function fetchSavedProps(date: string, eventIds?: string[]) {
    let url = `${API_URL}/props/${date}`;
    if (eventIds && eventIds.length > 0) {
        url += `?event_ids=${eventIds.join(',')}`;
    }
    return await fetchWithCache(url);
}

export async function fetchPredictionContext(eventId: string, awayTeamId: number, homeTeamId: number, awayStarterId?: number, homeStarterId?: number) {
    let url = `${API_URL}/predictions/context?event_id=${eventId}&away_team_id=${awayTeamId}&home_team_id=${homeTeamId}`;
    if (awayStarterId) url += `&away_starter_id=${awayStarterId}`;
    if (homeStarterId) url += `&home_starter_id=${homeStarterId}`;
    return await fetchWithCache(url);
}

export async function fetchOpponentStarters(teamId: number, year: number) {
  return await fetchWithCache(`${API_URL}/teams/${teamId}/opponents/starters?year=${year}`);
  
  
}

export async function fetchOpponentBatters(teamId: number, year: number) {
  return await fetchWithCache(`${API_URL}/teams/${teamId}/opponents/batters?year=${year}`);
  
  
}


export async function fetchOpponentBattingSplits(teamId: number, outs: number, year: number) {
  return await fetchWithCache(`${API_URL}/teams/${teamId}/splits/batting?outs=${outs}&year=${year}`);
  
  
}

export async function fetchBatchPlayerGameLogs(playerIds: string[], year: number, limit: number = 15) {
  if (!playerIds || playerIds.length === 0) return {};
  const url = `${API_URL}/players/gamelogs/batch?player_ids=${playerIds.join(',')}&year=${year}&limit=${limit}`;
  return await fetchWithCache(url);
  
  
}

export async function fetchBvpStats(batterId: string | number, pitcherId: string | number) {
  return await fetchWithCache(`${API_URL}/bvp/${batterId}/${pitcherId}`);
  
  
}

export async function fetchGameOdds(gameId: string) {
    try {
        return await fetchWithCache(`${API_URL}/games/${gameId}/odds`);
    } catch (e) {
        return null;
    }
}
