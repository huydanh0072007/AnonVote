// Participant Logic
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('id');

    if (!roomId) {
        alert('Mã phòng không hợp lệ!');
        window.location.href = 'index.html';
        return;
    }

    const pinScreen = document.getElementById('pinScreen');
    const mainContent = document.getElementById('mainContent');
    const roomNameDisplay = document.getElementById('roomNameDisplay');
    const currentRoomLabel = document.getElementById('currentRoomLabel');
    const pinInput = document.getElementById('pinInput');
    const btnVerifyPin = document.getElementById('btnVerifyPin');
    const pinError = document.getElementById('pinError');
    const pinInputContainer = document.getElementById('pinNumbers'); // Default to numbers for now

    let currentServerPin = '';
    let pinType = 'number';

    // 1. Fetch Room Info (Smart lookup)
    let room = null;
    let roomError = null;

    // Try searching by short_id first (most common for participants)
    const { data: byShortId, error: errorShort } = await supabase
        .from('rooms')
        .select('*')
        .eq('short_id', roomId)
        .maybeSingle();

    if (byShortId) {
        room = byShortId;
    } else {
        // If not found by short_id, try by UUID if it looks like one
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
        if (isUUID) {
            const { data: byId, error: errorId } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .maybeSingle();
            room = byId;
            roomError = errorId;
        }
    }

    if (!room) {
        alert('Phòng không tồn tại hoặc mã không đúng!');
        window.location.href = 'index.html';
        return;
    }

    // Critical: Update roomId variable to the actual record UUID for further queries
    const actualRoomId = room.id;

    roomNameDisplay.innerText = room.name;
    currentRoomLabel.innerText = room.name;
    currentServerPin = room.current_pin;
    pinType = room.settings.pin_type || 'number';

    // Apply background image if exists
    if (room.bg_url) {
        document.body.style.backgroundImage = `url('${room.bg_url}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    }

    // Show correct input type
    if (pinType === 'number') {
        pinInputContainer.classList.remove('hidden');
    } else {
        document.getElementById('pinIcons').classList.remove('hidden');
    }

    // 2. Real-time PIN updates
    supabase.channel(`room_public_${actualRoomId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${actualRoomId}` }, payload => {
            currentServerPin = payload.new.current_pin;
            console.log('PIN updated on server!');
        })
        .subscribe();

    // 3. Verify Logic
    let voterIcons = [];
    const selectedIconsContainer = document.getElementById('selectedIcons');

    // Handle Icon Clicks
    document.querySelectorAll('.icon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (voterIcons.length < 4) {
                voterIcons.push(btn.dataset.icon);
                renderSelectedIcons();
            }
        });
    });

    function renderSelectedIcons() {
        selectedIconsContainer.innerHTML = voterIcons.join(' ');
    }

    btnVerifyPin.addEventListener('click', () => {
        let userPin = '';
        if (pinType === 'number') {
            userPin = pinInput.value.trim();
        } else {
            userPin = voterIcons.join('');
        }

        if (userPin === currentServerPin) {
            // Success! 
            localStorage.setItem(`voter_auth_${actualRoomId}`, 'true');
            pinScreen.classList.add('hidden');
            mainContent.classList.remove('hidden');
        } else {
            pinError.classList.remove('hidden');
            // reset icon input
            voterIcons = [];
            renderSelectedIcons();
            pinInput.value = '';
        }
    });

    // 5. Poll Display Logic
    const pollDisplay = document.getElementById('pollDisplay');

    async function loadActivePoll() {
        const { data: polls } = await supabase
            .from('polls')
            .select('*')
            .eq('room_id', actualRoomId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1);

        if (polls && polls.length > 0) {
            renderPoll(polls[0]);
        } else {
            pollDisplay.innerHTML = `
                <i data-lucide="clock" size="48" class="text-gray-600 mb-4"></i>
                <h2 class="text-xl font-semibold">Đang đợi Host bắt đầu...</h2>
                <p class="text-sm text-gray-500 mt-2">Cuộc bình chọn sẽ tự động hiện ra tại đây.</p>
            `;
            lucide.createIcons();
        }
    }

    function renderPoll(poll) {
        // Check if user already voted for this poll
        const hasVoted = localStorage.getItem(`voted_poll_${poll.id}`);

        if (hasVoted) {
            pollDisplay.innerHTML = `
                <i data-lucide="check-circle" size="48" class="text-green-500 mb-4"></i>
                <h2 class="text-xl font-semibold">Cảm ơn bạn đã bình chọn!</h2>
                <p class="text-sm text-gray-500 mt-2">Đang chờ sự kiện tiếp theo từ Host...</p>
            `;
            lucide.createIcons();
            return;
        }

        const optionsHtml = poll.options.map(opt => `
            <button onclick="submitVote('${poll.id}', '${opt.id}')" 
                    class="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-left hover:bg-primary/20 hover:border-primary/50 transition-all font-medium">
                ${opt.label}
            </button>
        `).join('');

        pollDisplay.innerHTML = `
            <div class="w-full animate-[fadeIn_0.5s_ease-out]">
                ${poll.image_url ? `<img src="${poll.image_url}" class="w-full h-40 object-cover rounded-2xl mb-6 border border-white/10 shadow-lg">` : ''}
                <h2 class="text-xl font-bold mb-6">${poll.question}</h2>
                <div class="flex flex-col gap-3">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }

    window.submitVote = async (pollId, optionId) => {
        const { error } = await supabase
            .from('votes')
            .insert([{
                poll_id: pollId,
                option_id: optionId,
                voter_fingerprint: localStorage.getItem('voter_fingerprint') || generateFingerprint()
            }]);

        if (error) {
            alert('Lỗi khi gửi phiếu bầu!');
        } else {
            localStorage.setItem(`voted_poll_${pollId}`, 'true');
            loadActivePoll();
        }
    }

    function generateFingerprint() {
        const fp = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('voter_fingerprint', fp);
        return fp;
    }

    // 6. Tab Switching Logic
    const tabPolls = document.getElementById('tabPolls');
    const tabQA = document.getElementById('tabQA');
    const pollTab = document.getElementById('pollTab');
    const qaTab = document.getElementById('qaTab');

    if (tabPolls && tabQA) {
        tabPolls.addEventListener('click', () => {
            tabPolls.classList.add('border-primary', 'text-white', 'bg-white/5');
            tabPolls.classList.remove('border-transparent', 'text-gray-500');
            tabQA.classList.remove('border-primary', 'text-white', 'bg-white/5');
            tabQA.classList.add('border-transparent', 'text-gray-500');
            pollTab.classList.remove('hidden');
            qaTab.classList.add('hidden');
        });

        tabQA.addEventListener('click', () => {
            tabQA.classList.add('border-primary', 'text-white', 'bg-white/5');
            tabQA.classList.remove('border-transparent', 'text-gray-500');
            tabPolls.classList.remove('border-primary', 'text-white', 'bg-white/5');
            tabPolls.classList.add('border-transparent', 'text-gray-500');
            qaTab.classList.remove('hidden');
            pollTab.classList.add('hidden');
            loadQA();
        });
    }

    // 7. Q&A Logic
    const qaInput = document.getElementById('qaInput');
    const btnSendQA = document.getElementById('btnSendQA');
    const qaList = document.getElementById('qaList');

    const TOXIC_WORDS = ['dm', 'chửi', 'xấu', 'tệ'];

    if (btnSendQA) {
        btnSendQA.addEventListener('click', async () => {
            const content = qaInput.value.trim();
            if (!content) return;

            const { error } = await supabase
                .from('questions')
                .insert([{
                    room_id: actualRoomId,
                    content: content,
                    is_toxic: TOXIC_WORDS.some(w => content.toLowerCase().includes(w))
                }]);

            if (error) {
                alert('Lỗi khi gửi ý kiến!');
            } else {
                qaInput.value = '';
                loadQA();
            }
        });
    }

    async function loadQA() {
        // Only show non-hidden questions
        const { data: qs } = await supabase
            .from('questions')
            .select('*')
            .eq('room_id', actualRoomId)
            .eq('is_toxic', false)
            .eq('is_hidden', false)
            .order('upvotes', { ascending: false });

        if (!qaList) return;

        if (!qs || qs.length === 0) {
            qaList.innerHTML = '<div class="text-center text-gray-600 text-xs py-10">Chưa có câu hỏi nào.</div>';
            return;
        }

        qaList.innerHTML = qs.map(q => `
            <div class="bg-white/5 border border-white/5 p-4 rounded-xl flex items-start gap-3 mb-2 ${q.is_answered ? 'opacity-70 bg-green-500/5 border-green-500/10' : ''}">
                <div class="flex-1">
                    ${q.is_answered ? '<span class="text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded-full uppercase font-bold mr-2 mb-1 inline-block">Đã trả lời</span>' : ''}
                    <p class="text-sm ${q.is_answered ? 'text-gray-300' : 'text-white'}">${q.content}</p>
                </div>
                <button onclick="upvoteQA('${q.id}', ${q.upvotes})" class="flex flex-col items-center gap-1 group">
                    <i data-lucide="heart" size="14" class="${localStorage.getItem(`upvoted_${q.id}`) ? 'text-red-500 fill-red-500' : 'text-gray-500 group-hover:text-red-400'} transition-all"></i>
                    <span class="text-[10px] ${localStorage.getItem(`upvoted_${q.id}`) ? 'text-red-400 font-bold' : 'text-gray-500'}">${q.upvotes}</span>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
    }

    window.upvoteQA = async (id, currentUpvotes) => {
        if (localStorage.getItem(`upvoted_${id}`)) return;
        const { error } = await supabase.from('questions').update({ upvotes: currentUpvotes + 1 }).eq('id', id);
        if (!error) {
            localStorage.setItem(`upvoted_${id}`, 'true');
            loadQA();
        }
    }

    // Subscribe to changes
    supabase.channel(`polls_${actualRoomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `room_id=eq.${actualRoomId}` }, () => {
            loadActivePoll();
        })
        .subscribe();

    supabase.channel(`qa_${actualRoomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `room_id=eq.${actualRoomId}` }, () => {
            loadQA();
        })
        .subscribe();

    // Initial load
    loadActivePoll();
});
