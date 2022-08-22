const fs = require("fs");

function presenceCalculator(startedTime, endedTime, channelId) {
    let presence = [];
    let j = 0;
    let lines = fs.readFileSync("./config/db.json", "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === "") continue;
        let line = JSON.parse(lines[i]);
        if (line.type == 'StartedTimeRequest') continue;
        if (line.channel == channelId || line.to == channelId || line.from == channelId) {
            if (line.time >= startedTime && line.time <= endedTime) {
                if (line.type == "joined" || (line.type == "switch" && line.to == channelId)) {
                    presence[j] = { user: line.user, nickname: line.nickname, type: "joined", time: line.time };
                    j++;
                }
                if (line.type == "leave" || (line.type == "switch" && line.from == channelId)) {
                    presence[j] = { user: line.user, nickname: line.nickname, type: "leave", time: line.time };
                    j++;
                }
            }
        }
    }
    let timeSpendperUser = [];
    for (let i = 0; i < presence.length; i++) {
        let user = presence[i].user;
        let type = presence[i].type;
        // add the user to the list if he is not already in it
        if (!timeSpendperUser.some(e => e.user == user)) {
            timeSpendperUser.push({ user: user, nickname: presence[i].nickname, time: 0 });
        }
        // add the time spend by the user
        if (type == "joined") {
            for (let j = i + 1; j < presence.length; j++) {
                if (presence[j].user == user && presence[j].type == "leave") {
                    timeSpendperUser.find(e => e.user == user).time += presence[j].time - presence[i].time;
                    break;
                }
            }
        }
    }
    console.log(timeSpendperUser);
    return timeSpendperUser;
}

module.exports = presenceCalculator;

presenceCalculator(1, 1 + 3600, "694595069386424411");