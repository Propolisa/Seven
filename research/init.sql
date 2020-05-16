CREATE TABLE cache(
    id SERIAL PRIMARY KEY,
    name text DEFAULT 'Unknown',
    json text DEFAULT '{}'
);

INSERT INTO cache(id,name,json) 
VALUES
	(DEFAULT, 'machines', '{}'),
    (DEFAULT, 'challenges', '{}'),
    (DEFAULT, 'team_members', '{}'),
    (DEFAULT, 'team_members_ignored', '{}'),
    (DEFAULT, 'team_stats', '{}'),
    (DEFAULT, 'discord_links', '{}');