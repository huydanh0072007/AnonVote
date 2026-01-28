// App Logic (Host & Basic Join)
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const splashRoomId = urlParams.get('id');

    if (splashRoomId) {
        // Use global supabase from supabase-config.js
        const { data: room } = await supabase.from('rooms').select('bg_url').eq('id', splashRoomId).single();
        if (room && room.bg_url) {
            document.body.style.backgroundImage = `url('${room.bg_url}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
        }
    }
    const btnCreateRoom = document.getElementById('btnCreateRoom');
    const btnJoinRoom = document.getElementById('btnJoinRoom');
    const joinCodeInput = document.getElementById('joinRoomId');
    const roomNameInput = document.getElementById('roomName');
    const joinError = document.getElementById('joinError');

    // Create Room Logic
    btnCreateRoom.addEventListener('click', async () => {
        const roomName = roomNameInput.value.trim();
        const pinType = document.querySelector('input[name="pinType"]:checked').value;

        if (!roomName) {
            roomNameInput.classList.add('animate-shake', 'border-red-500');
            setTimeout(() => roomNameInput.classList.remove('animate-shake'), 400);
            return;
        }
        roomNameInput.classList.remove('border-red-500');

        btnCreateRoom.disabled = true;
        btnCreateRoom.innerHTML = '<i data-lucide="loader-2" class="animate-spin" size="20"></i> Đang tạo...';
        lucide.createIcons();

        // Generate a random HostKey (64 chars) to identify the owner
        const hostKey = generateRandomKey(64);
        // Generate a simple 6-char Short ID (A-Z, 0-9)
        const shortId = generateRandomKey(6, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');

        try {
            const { data, error } = await supabase
                .from('rooms')
                .insert([
                    {
                        name: roomName,
                        host_key: hostKey,
                        short_id: shortId,
                        settings: {
                            pin_type: pinType,
                            pin_interval: 30,
                            max_voters: 1000,
                            calc_method: "total_participants"
                        },
                        current_pin: pinType === 'number' ? '0000' : '🍎🍎🍎🍎' // Initial PIN
                    }
                ])
                .select();

            if (error) throw error;

            if (data && data[0]) {
                const newRoom = data[0];
                const hostData = {
                    roomId: newRoom.id,
                    hostKey: hostKey,
                    roomName: newRoom.name
                };
                localStorage.setItem(`host_${newRoom.id}`, JSON.stringify(hostData));
                window.location.href = `host-dashboard.html?id=${newRoom.id}&key=${hostKey}&new=true`;
            }
        } catch (err) {
            console.error('Error creating room:', err);
            alert('Có lỗi xảy ra khi tạo phòng. Vui lòng thử lại!');
            btnCreateRoom.disabled = false;
            btnCreateRoom.innerHTML = 'Khởi tạo phòng <i data-lucide="sparkles" size="20"></i>';
            lucide.createIcons();
        }
    });

    // Join Room Logic
    const handleJoin = () => {
        const roomCode = joinCodeInput.value.trim().toUpperCase();
        if (!roomCode) {
            joinCodeInput.classList.add('animate-shake', 'border-red-500');
            setTimeout(() => joinCodeInput.classList.remove('animate-shake'), 400);
            return;
        }
        window.location.href = `participant.html?id=${roomCode}`;
    };

    btnJoinRoom.addEventListener('click', handleJoin);
    joinCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleJoin();
    });

    // Helper: Generate Random Key
    function generateRandomKey(length, customChars) {
        const chars = customChars || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
});
