const GAME_MODES = {
    france: {
        name: 'France',
        icon: '/img/France.png'
    },
    mondial: {
        name: 'Mondial',
        icon: '/img/Mondial.png'
    },
    disneyland: {
        name: 'Disneyland',
        icon: '/img/disney.png'
    },
    nevers: {
        name: 'Nevers',
        icon: '/img/nevers.png'
    },
    versaille: {
        name: 'Versaille',
        icon: '/img/versaille.png'
    },
    dark: {
        name: 'Dark Mode',
        icon: '/img/lampe.png'
    }
};

const validateGameMode = (mode) => {
    return GAME_MODES.hasOwnProperty(mode);
};

const getModeKey = (mode) => {
    return validateGameMode(mode) ? `${mode}Mode` : null;
};

module.exports = {
    GAME_MODES,
    validateGameMode,
    getModeKey
};