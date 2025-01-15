const config = {
    BOARD_SIZE: 50,
    PIXEL_COOLDOWN: 300
};

if (typeof window === 'undefined') {
    module.exports = config;
} else {
    window.config = config;
}