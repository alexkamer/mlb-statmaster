\restrict AkCSooLi1Bh2ojDrEOkEnlKS03AVSLZha7CgAFpMpyI1blpg5gTdWzdv5Dqoqqs
SELECT pg_catalog.set_config('search_path', '', false);
CREATE TABLE public.athletes (
    athlete_id bigint NOT NULL,
    uid text,
    first_name text,
    last_name text,
    full_name text,
    display_name text,
    weight double precision,
    height double precision,
    age double precision,
    date_of_birth timestamp with time zone,
    birth_city text,
    birth_state text,
    birth_country text,
    bats text,
    throws text,
    is_active boolean,
    position_id bigint
);
CREATE TABLE public.event_boxscores_batting (
    event_batting_id text NOT NULL,
    event_id bigint,
    team_id bigint,
    athlete_id bigint,
    starter boolean,
    position_id bigint,
    ab bigint,
    r bigint,
    h bigint,
    rbi bigint,
    hr bigint,
    bb bigint,
    k bigint,
    pitches_faced bigint,
    d bigint,
    t bigint,
    sb bigint
);
CREATE TABLE public.event_boxscores_pitching (
    event_pitching_id text NOT NULL,
    event_id bigint,
    team_id bigint,
    athlete_id bigint,
    starter boolean,
    ip text,
    h bigint,
    r bigint,
    er bigint,
    bb bigint,
    k bigint,
    hr bigint,
    pitches bigint,
    recorded_win boolean DEFAULT false
);
CREATE TABLE public.event_competitors (
    event_competitor_id text NOT NULL,
    event_id bigint,
    team_id bigint,
    season_team_id text,
    home_away text,
    winner boolean,
    score bigint
);
CREATE TABLE public.events (
    event_id bigint NOT NULL,
    date timestamp without time zone,
    name text,
    short_name text,
    season_year bigint,
    attendance bigint,
    venue_id bigint,
    type_id integer
);
CREATE TABLE public.season_teams (
    season_year bigint,
    team_id bigint,
    uid text,
    location text,
    name text,
    abbreviation text,
    display_name text,
    color text,
    alternate_color text,
    is_active boolean,
    franchise_id bigint,
    venue_id double precision,
    group_id bigint,
    season_team_id text NOT NULL
);
    ADD CONSTRAINT athletes_pkey PRIMARY KEY (athlete_id);
    ADD CONSTRAINT event_boxscores_batting_pkey PRIMARY KEY (event_batting_id);
    ADD CONSTRAINT event_boxscores_pitching_pkey PRIMARY KEY (event_pitching_id);
    ADD CONSTRAINT event_competitors_pkey PRIMARY KEY (event_competitor_id);
    ADD CONSTRAINT events_pkey PRIMARY KEY (event_id);
    ADD CONSTRAINT season_teams_pkey PRIMARY KEY (season_team_id);
CREATE INDEX idx_batting_athlete_event ON public.event_boxscores_batting USING btree (athlete_id, event_id);
CREATE INDEX idx_batting_athlete_id ON public.event_boxscores_batting USING btree (athlete_id);
CREATE INDEX idx_batting_athlete_starter ON public.event_boxscores_batting USING btree (athlete_id, starter);
CREATE INDEX idx_batting_event_id ON public.event_boxscores_batting USING btree (event_id);
CREATE INDEX idx_batting_starter ON public.event_boxscores_batting USING btree (starter);
CREATE INDEX idx_batting_team_id ON public.event_boxscores_batting USING btree (team_id);
CREATE INDEX idx_boxscores_batting_starter ON public.event_boxscores_batting USING btree (starter, athlete_id);
CREATE INDEX idx_boxscores_pitching_starter ON public.event_boxscores_pitching USING btree (starter, athlete_id);
CREATE INDEX idx_event_competitors_event_id ON public.event_competitors USING btree (event_id);
CREATE INDEX idx_event_competitors_team_id ON public.event_competitors USING btree (team_id);
CREATE INDEX idx_events_date ON public.events USING btree (date DESC);
CREATE INDEX idx_events_date_id ON public.events USING btree (date, event_id);
CREATE INDEX idx_events_season_type ON public.events USING btree (season_year);
CREATE INDEX idx_events_season_year ON public.events USING btree (season_year);
CREATE INDEX idx_pitching_athlete_event ON public.event_boxscores_pitching USING btree (athlete_id, event_id);
CREATE INDEX idx_pitching_athlete_id ON public.event_boxscores_pitching USING btree (athlete_id);
CREATE INDEX idx_pitching_athlete_starter ON public.event_boxscores_pitching USING btree (athlete_id, starter);
CREATE INDEX idx_pitching_event_id ON public.event_boxscores_pitching USING btree (event_id);
CREATE INDEX idx_pitching_starter ON public.event_boxscores_pitching USING btree (starter);
CREATE INDEX idx_pitching_team_id ON public.event_boxscores_pitching USING btree (team_id);
\unrestrict AkCSooLi1Bh2ojDrEOkEnlKS03AVSLZha7CgAFpMpyI1blpg5gTdWzdv5Dqoqqs
