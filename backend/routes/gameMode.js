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
    disneyland: {
        name: 'Disneyland',
        icon: '/img/disney.png',
        statKey: 'disneylandMode'
    },
    versaille: {
        name: 'Versailles',
        icon: '/img/versaille.png',
        statKey: 'versailleMode'
    },
    nevers: {
        name: 'Nevers',
        icon: '/img/nevers.png',
        statKey: 'neversMode'
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

const getModeInfo = (mode) => {
    if (!validateGameMode(mode)) return null;
    return GAME_MODES[mode];
};

module.exports = {
    GAME_MODES,
    validateGameMode,
    getModeInfo
};