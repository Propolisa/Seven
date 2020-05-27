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
    (DEFAULT, 'team_stats', '{ "globalRanking": 5, "points": 0, "teamFounder": "7383", "topMembers": [0, 1, 2, 3], "name": "", "owns": { "users": 0, "roots": 0 }, "imgUrl": "" }'),
    (DEFAULT, 'discord_links', '{}');