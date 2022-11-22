/** Inputs */
const MAX_VALUE = 100;
const MAX_GAMES = 100;
const MIN_SUGGESTED_MULTIPLIER = 2;

/** Simulation **/
let balance = 10000;
const INITIAL_BET = 10;
let bet = INITIAL_BET;
const threshold = 4; // in percentage %
let simulationON = false;
let maxBalance = 1000;
/***************************************s
 GLOBALS
 ***************************************/
const GRAPH_HEIGHT = 570;
const GRAPH_WIDTH = 1000;
let gamesRecorded = [];
const historyPanel = document.querySelector('div.switchable-area');
const historyTab = document.querySelector('ul[class*="nav nav-tabs _tabsLeft"] > li:nth-child(2)');
const chatTab = document.querySelector('ul[class*="nav nav-tabs _tabsLeft"] > li:nth-child(1)');

function injectPlotterScript() {
    let scriptHead = document.createElement("script");
    scriptHead.setAttribute('src', 'https://cdn.plot.ly/plotly-2.14.0.min.js');
    document.getElementsByTagName("head")[0].appendChild(scriptHead);
}

function watchForTabChanges() {
    const config = {attributes: true, childList: true, subtree: true};

    const observer = new MutationObserver((mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.addedNodes.length === 1) {
                if (mutation.addedNodes[0].nodeName === 'TABLE') {
                    mutation.addedNodes[0].childNodes[1].childNodes.forEach((e) => {
                        gamesRecorded.push(parseFloat(e.innerText.replaceAll(/\D\./g, '')));
                    });
                } else if (mutation.addedNodes[0].nodeName === 'TR') {
                    gamesRecorded.unshift(parseFloat(mutation.addedNodes[0].childNodes[0].childNodes[0].innerText.replaceAll(/\D\./g, '')));

                    if (gamesRecorded.length > MAX_GAMES) {
                        gamesRecorded.pop();
                    }
                }
                updateGraph();
            }
        }
    });

    observer.observe(historyPanel, config);

    historyTab.click();
    chatTab.remove();
}

function updateGraph() {
    const graphContainer = document.getElementById('graphContainer');

    /** Actual results **/
    let actual = {
        x: [],
        y: [],
        type: 'scatter',
        name: 'Actual',
        width: GRAPH_WIDTH - 50,
        height: GRAPH_HEIGHT - 30,
        line: {color: 'red'}
    }

    actual.x = gamesRecorded.slice();
    actual.x.sort((a, b) => a - b);
    actual.x = actual.x.map(x => x < MAX_VALUE ? x : (MAX_VALUE));
    actual.y = actual.x.map((value, index, array) => {
        return array.filter(x => x >= value).length * 100 / actual.x.length;
    });

    /** Expected results **/

    let expected = {
        x: actual.x,
        y: null,
        type: 'scatter',
        name: 'Expected',
        width: GRAPH_WIDTH - 50,
        height: GRAPH_HEIGHT - 30,
        color: 'blue'
    };
    expected.y = expected.x.map(x => 99 / x);

    let maxDifference = {
        value: 0,
        index: -1
    };

    expected.y.forEach((v, i) => {
        if ((expected.x[i] >= MIN_SUGGESTED_MULTIPLIER) && (100 - actual.y[i] * 100 / expected.y[i]) > maxDifference.value) {
            maxDifference = {value: 100 - actual.y[i] * 100 / expected.y[i], index: i};
        }
    });

    let suggestedPlay = {
        x: [expected.x[maxDifference.index], actual.x[maxDifference.index]],
        y: [expected.y[maxDifference.index], actual.y[maxDifference.index]],
        mode: 'lines+markers',
        line: {color: 'green'},
        name: 'Suggested',
    }

    /** Simulation **/
    if (simulationON) {
        if (maxDifference.value >= threshold) {

            if (gamesRecorded[0] >= expected.x[maxDifference.index]) {
                balance += (bet * (expected.x[maxDifference.index] - 1));
                bet = INITIAL_BET;
            } else {
                balance -= bet;
                bet = Math.ceil((maxBalance + 1 - balance) / (expected.x[maxDifference.index] - 1));
            }

            console.log(`Betting on ${expected.x[maxDifference.index]}x... with ${bet} bits`);
            console.log('Result is ' + gamesRecorded[0]);

            maxBalance = balance > maxBalance ? balance : maxBalance;

            if (balance <= 0) {
                simulationON = false;
                console.log("You lost everything.");
            }

            console.log("Balance: " + balance);
        }
    }

    /** Graphing **/

    let annotations = [{
        xref: 'paper',
        yref: 'paper',
        x: 0,
        xanchor: 'right',
        y: 1,
        yanchor: 'bottom',
        text: 'Frequency(%)',
        showarrow: false
    }, {
        xref: 'paper',
        yref: 'paper',
        x: 1,
        xanchor: 'left',
        y: 0,
        yanchor: 'top',
        text: 'Multiplier(x)',
        showarrow: false
    }];

    let data = [expected, actual];
    if (suggestedPlay.x[0] > 0) {
        data.push(suggestedPlay);
        annotations.push({
            x: expected.x[maxDifference.index],
            y: expected.y[maxDifference.index],
            xref: 'x',
            yref: 'y',
            text: `Suggested play ${expected.x[maxDifference.index]}x <br>${maxDifference.value.toFixed(2)}% below expectations`,
            showarrow: true,
            arrowhead: 7,
            ax: 225 * (expected.x[maxDifference.index] < 10 ? 1 : -1),
            ay: -40
        });
    } else {
        annotations.push({
            x: expected.x[expected.x.length - 1] / 2,
            y: 50,
            xref: 'x',
            yref: 'y',
            showarrow: false,
            text: `Do not play at this time`,
            arrowhead: 7,
        });
    }

    Plotly.newPlot(graphContainer, data,
        {
            title: {
                text: `Sample size n = ${gamesRecorded.length}`,
                font: {
                    family: 'Courier New, monospace',
                    size: 12
                },
                xref: 'paper',
                x: 0.05,
            },
            annotations: annotations
        });
}


function createGraphContainer() {
    historyPanel.style.width = '70%';
    let floatingElement = document.createElement('div');

    floatingElement.id = 'graphContainer'
    floatingElement.style.width = `${GRAPH_WIDTH}px`;
    floatingElement.style.height = `${GRAPH_HEIGHT}px`;
    floatingElement.style['z-index'] = 9999;
    floatingElement.style.position = 'fixed';
    floatingElement.style.top = `${970 - GRAPH_HEIGHT}px`;
    floatingElement.style.left = '900px';

    document.getElementsByTagName('body')[0].appendChild(floatingElement);
}


function main() {
    createGraphContainer();
    injectPlotterScript();

    setTimeout(watchForTabChanges, 2000);
}

main();