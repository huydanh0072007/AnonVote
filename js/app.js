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
    const joinCodeInput = document.getElementById('joinCode');

    // Create Room Logic
    btnCreateRoom.addEventListener('click', async () => {
        const roomName = prompt('Nhập tên cuộc họp/sự kiện của bạn:');
        if (!roomName) return;

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
                            pin_type: "number",
                            pin_interval: 30,
                            max_voters: 1000,
                            calc_method: "total_participants"
                        }
                    }
                ])
                .select();

            if (error) throw error;

            if (data && data[0]) {
                const newRoom = data[0];
                // Save HostKey to LocalStorage for this device
                const hostData = {
                    roomId: newRoom.id,
                    hostKey: hostKey,
                    roomName: newRoom.name
                };
                localStorage.setItem(`host_${newRoom.id}`, JSON.stringify(hostData));

                // Clear temporary background if any
                document.body.style.backgroundImage = '';

                // Redirect to Host Dashboard
                window.location.href = `host-dashboard.html?id=${newRoom.id}&key=${hostKey}`;
            }
        } catch (err) {
            console.error('Error creating room:', err);
            alert('Có lỗi xảy ra khi tạo phòng. Vui lòng thử lại!');
        }
    });

    // Join Room Logic
    btnJoinRoom.addEventListener('click', () => {
        const roomCode = joinCodeInput.value.trim();
        if (!roomCode) {
            alert('Vui lòng nhập mã phòng!');
            return;
        }
        // Redirect to Participant View
        window.location.href = `participant.html?id=${roomCode}`;
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
