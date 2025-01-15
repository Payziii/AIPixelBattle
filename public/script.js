const BOARD_SIZE = config.BOARD_SIZE

document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const usernameInput = document.getElementById('username');
    const resetButton = document.getElementById('reset');
     const toggleGrid = document.getElementById('toggle-grid');
    const colorPalette = document.getElementById('color-palette');
     const customColorInput = document.getElementById('custom-color');
    const selectedColorPreview = document.getElementById('selected-color-preview');
     const leaderboardList = document.getElementById('leaderboard-list');
    let pixels = [];
     let selectedColor = null;
    let customColor = '#ff0000';
    const pixelSize = 10;
       let gridEnabled = true; // Изначально сетка включена
    let telegramUsername = null;


    // Цвета
    const colors = [
        'red',
        'blue',
        'green',
        'yellow',
        'purple',
        'orange',
        'pink',
        'brown',
        'cyan',
        'lime'
    ];

    // Создаем палитру
     function createColorPalette(){
        colors.forEach((color, index) => {
            const colorOption = document.createElement('div');
            colorOption.classList.add('color-option');
            colorOption.style.backgroundColor = color;
            colorOption.dataset.colorId = index + 1;
             colorOption.dataset.color = color;
            colorOption.addEventListener('click', () => {
                 selectedColor = parseInt(colorOption.dataset.colorId);
                customColor = colorOption.dataset.color;
                selectedColorPreview.style.backgroundColor = color;
            });
            colorPalette.appendChild(colorOption);
        });
        selectedColorPreview.style.backgroundColor = colors[0];
    }
    createColorPalette();
    
    customColorInput.addEventListener('input', () => {
         selectedColor = null;
        customColor = customColorInput.value;
        selectedColorPreview.style.backgroundColor = customColor;
    })


        // Функция для настройки размера доски
    function setBoardSize(){
        board.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, ${pixelSize}px)`;
    }
    setBoardSize();
        gridEnabled = toggleGrid.checked;
       // Проверяем, запущено ли приложение в Telegram Web Apps
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        const initData = window.Telegram.WebApp.initDataUnsafe;
         if (initData && initData.user) {
              const user = initData.user;
              if(user.username) {
                telegramUsername = user.username;
              } else if (user.first_name && user.last_name){
                  telegramUsername = `${user.first_name} ${user.last_name}`
              } else if (user.first_name) {
                  telegramUsername = user.first_name;
              }
              usernameInput.value = telegramUsername;
                usernameInput.readOnly = true;

        }
    }
     
    toggleGrid.addEventListener('change', () => {
      gridEnabled = toggleGrid.checked;
        renderBoard();
    });

    // WebSocket setup
    const ws = new WebSocket(`ws://localhost:3000`);

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        fetchPixels();
         fetchLeaderboard();
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'pixels') {
            pixels = message.data;
            renderBoard();
            fetchLeaderboard();
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

     function renderBoard() {
        board.innerHTML = '';
        pixels.forEach((pixelData, index) => {
            const pixel = document.createElement('div');
            pixel.classList.add('pixel');
            pixel.style.width = `${pixelSize}px`;
            pixel.style.height = `${pixelSize}px`;
             if (gridEnabled) {
                pixel.style.border = '1px solid lightgray';
             } else {
                pixel.style.border = 'none';
              }
                pixel.style.backgroundColor = pixelData.color == 0 ? 'white' : getColor(pixelData.color);
           
            pixel.dataset.index = index;
             if(pixelData.owner_id){
              pixel.title = pixelData.owner_id;
            }
            pixel.addEventListener('click', () => {
                if (!usernameInput.value) {
                    alert('Please enter a username');
                    return;
                }
                const x = index % BOARD_SIZE;
                const y = Math.floor(index / BOARD_SIZE);
                  let colorToUse = selectedColor;
                   if(!selectedColor) {
                       colorToUse = customColor;
                    }
                 fetch('/api/pixels', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ x, y, username: usernameInput.value, color: colorToUse }),
                 })
                 .then((response) => {
                    if (!response.ok) {
                      if (response.status === 429) {
                        alert('Cooldown period. Wait before next move.');
                      }
                      throw new Error('Network response was not ok');
                    }
                    return response.json();
                  })
                  .catch((error) => console.error('Error:', error));
            });
            board.appendChild(pixel);
        });
    }

    function getColor(id) {
         if(typeof id === 'string'){
            return id;
         }
        return colors[(id - 1) % colors.length]
    }

    function fetchPixels() {
        fetch('/api/pixels')
            .then((response) => response.json())
            .then((data) => {
                pixels = data;
                renderBoard();
            })
            .catch((error) => console.error('Error:', error));
    }

      function fetchLeaderboard() {
        fetch('/api/leaderboard')
            .then(response => response.json())
            .then(data => {
                renderLeaderboard(data);
            })
            .catch(error => console.error('Error fetching leaderboard:', error));
    }

      function renderLeaderboard(leaderboardData) {
          leaderboardList.innerHTML = '';
        leaderboardData.forEach(user => {
          const li = document.createElement('li');
          li.textContent = `${user.username}: ${user.pixel_count}`;
          leaderboardList.appendChild(li);
        });
      }

    resetButton.addEventListener('click', () => {
        fetchPixels();
         fetchLeaderboard();
    });
});
