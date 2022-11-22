var config = {
    min_games_sample: {value: 50, type: 'number', label: 'Min Games Sample'},
    max_games_sample: {value: 150, type: 'number', label: 'Max Games Sample'},
    min_multiplier: {value: 3, type: 'multiplier', label: 'Min Multiplier'},
    max_multiplier: {value: 60, type: 'multiplier', label: 'Max Multiplier'},
    initial_bet: {value: 1000, type: 'balance', label: 'Base Bet'},
    threshold: {value: 17, type: 'number', label: 'Min Deviation(%)'},
    min_recover: {value: 10, type: 'number', label: 'Min Recovery'}
};

const gamesRecorded = [];
let suggestedPlay;
let bet = config.initial_bet.value;
let played_last_game = false;
let maxBalance = 0;

function getDeviation(multiplier, frequency) {
    return 100 - (frequency / (0.99 / multiplier) * 100);
}

// Creating sample
engine.on('GAME_ENDED', function () {
    if (gamesRecorded.length === 0) {
        gamesRecorded.push(...engine.history.toArray());
    } else {
        gamesRecorded.unshift(engine.history.first());
        if (gamesRecorded.length > config.max_games_sample.value) {
            gamesRecorded.pop();
        }
    }

    let frequencyMap = structuredClone(gamesRecorded);
    frequencyMap.sort((a, b) => a.bust - b.bust);
    frequencyMap = frequencyMap.map(x => {
        x.bust = x.bust < config.max_multiplier.value ? x.bust : config.max_multiplier.value;
        return x;
    });
    frequencyMap = frequencyMap.map((value, index, array) => {
        return {
            v: value.bust,
            f: array.filter(x => x.bust >= value.bust).length / frequencyMap.length
        };
    });

    suggestedPlay = {
        multiplier: 0,
        dv: 0
    };

    frequencyMap.forEach((v, i, a) => {
        const dv = getDeviation(v.v, v.f);
        if (dv > suggestedPlay.dv) {
            if (dv >= config.threshold.value && v.v > config.min_multiplier.value) {
                suggestedPlay.multiplier = v.v;
                suggestedPlay.dv = dv;
            }
        }
    });

    if (gamesRecorded.length >= config.min_games_sample.value) {
        if (suggestedPlay.multiplier > 0) {
            log(`Suggesting to play ${suggestedPlay.multiplier}x because actual results are ${suggestedPlay.dv.toFixed(2)}% below
    expectations`);
        } else {
            log(`No multipliers are above the threshold of ${config.threshold.value}% deviation`);
        }
    } else {
        log(`Waiting to collect enough samples (n = ${config.min_games_sample.value}`);
    }

    if (userInfo.balance > maxBalance) {
        maxBalance = userInfo.balance;
    }
});

engine.on('GAME_STARTING', function () {

    log(`Current sample size n = ${gamesRecorded.length}`)
    if (suggestedPlay?.multiplier && gamesRecorded.length >= config.min_games_sample.value) {

        if (engine.history.first().cashedAt  != null) {
            bet = config.initial_bet.value;
        } else if (played_last_game) {
            bet = Math.ceil((maxBalance + (config.min_recover.value * 100) - userInfo.balance) / (suggestedPlay.multiplier - 1) / 100) * 100;
        }

        if (suggestedPlay.multiplier > 0) {
            log(`Betting ${bet / 100} on ${suggestedPlay.multiplier}x`);
            engine.bet(bet, suggestedPlay.multiplier);
            played_last_game = true;
        } else {
            played_last_game = false;
        }
    }
});