DROP TABLE cache;

CREATE TABLE cache(
    id integer NOT NULL DEFAULT nextval('cache_id_seq'::regclass),
    name text COLLATE pg_catalog."default" DEFAULT 'Unknown'::text,
    json text COLLATE pg_catalog."default" DEFAULT '{}'::text,
    CONSTRAINT cache_pkey PRIMARY KEY (id)
);

INSERT INTO cache(id,name,json) 
VALUES
	(DEFAULT, 'machines', '{}'),
	(DEFAULT, 'challenges', '{}'),
	(DEFAULT, 'team_members', '{}'),
	(DEFAULT, 'team_members_ignored', '{}'),
	(DEFAULT, 'team_stats', '{}'),
	(DEFAULT, 'discord_links', '{}'),
	(DEFAULT, 'machine_tags', '{}'),
	(DEFAULT, 'misc', '{}');