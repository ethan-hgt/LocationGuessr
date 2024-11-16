const GAME_MODES = {
    france: {
        name: 'France',
        icon: '/img/France.png',
        statKey: 'franceMode'
    },
    mondial: {
        name: 'Mondial',
        icon: '/img/Mondial.png',
        statKey: 'mondialMode'
    },
    parc: {
        name: 'Disneyland',
        icon: '/img/disney.png',
        statKey: 'disneylandMode'
    },
    nevers: {
        name: 'Nevers',
        icon: '/img/nevers.png',
        statKey: 'neversMode'
    },
    versailles: {  
        name: 'Versailles',
        icon: '/img/versaille.png',
        statKey: 'versaillesMode'
    },
    dark: {
        name: 'Dark Mode',
        icon: '/img/lampe.png',
        statKey: 'darkMode'
    }
};

const validateGameMode = (mode) => {
    return GAME_MODES.hasOwnProperty(mode);
};

const getModeKey = (mode) => {
    if (!validateGameMode(mode)) return null;
    return GAME_MODES[mode].statKey;
};

const getModeInfo = (mode) => {
    if (!validateGameMode(mode)) return null;
    return GAME_MODES[mode];
};

module.exports = {
    GAME_MODES,
    validateGameMode,
    getModeKey,
    getModeInfo
};