// Host Dashboard Logic
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('id');
    const hostKey = urlParams.get('key');

    if (!roomId || !hostKey) {
        alert('Thông tin không hợp lệ!');
        window.location.href = 'index.html';
        return;
    }

    const roomTitle = document.getElementById('roomTitle');
    const displayPin = document.getElementById('roomPin');
    const statOnline = document.getElementById('participantCount');
    const statVoted = document.getElementById('totalVotesCount');

    // 1. Fetch Room Data
    const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .eq('host_key', hostKey)
        .single();

    if (error || !room) {
        alert('Không tìm thấy cuộc họp hoặc khóa bảo mật không đúng!');
        window.location.href = 'index.html';
        return;
    }

    roomTitle.innerText = room.name;
    const activeShortId = room.short_id || roomId;

    // 2. PIN Rotation Logic
    let currentPin = '';

    function generatePin() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    async function rotatePin() {
        currentPin = generatePin();
        displayPin.innerText = currentPin;

        // Update to Supabase
        await supabase
            .from('rooms')
            .update({ current_pin: currentPin })
            .eq('id', roomId);
    }

    // Initial PIN
    rotatePin();

    // Rotate based on settings
    const interval = (room.settings.pin_interval || 30) * 1000;
    setInterval(rotatePin, interval);

    // 6. Poll Management
    const btnAddPoll = document.getElementById('btnAddPoll');
    const pollList = document.getElementById('pollList');
    const modalPoll = document.getElementById('modalPoll');
    const btnCancelPoll = document.getElementById('btnCancelPoll');
    const btnSavePoll = document.getElementById('btnSavePoll');

    btnAddPoll.addEventListener('click', () => {
        modalPoll.classList.remove('hidden');
    });

    btnCancelPoll.addEventListener('click', () => {
        modalPoll.classList.add('hidden');
        resetPollForm();
    });

    // Handle Poll Type Change
    const pollType = document.getElementById('pollType');
    const matrixCriteriaContainer = document.getElementById('matrixCriteriaContainer');
    pollType.addEventListener('change', () => {
        if (pollType.value === 'matrix') {
            matrixCriteriaContainer.classList.remove('hidden');
        } else {
            matrixCriteriaContainer.classList.add('hidden');
        }
    });

    function resetPollForm() {
        document.getElementById('pollQuestion').value = '';
        document.getElementById('pollOptions').value = '';
        document.getElementById('pollImage').value = '';
        document.getElementById('pollType').value = 'choice';
        matrixCriteriaContainer.classList.add('hidden');
    }

    btnSavePoll.addEventListener('click', async () => {
        const question = document.getElementById('pollQuestion').value.trim();
        const optionsRaw = document.getElementById('pollOptions').value.trim();
        const type = document.getElementById('pollType').value;
        const imageFile = document.getElementById('pollImage').files[0];

        if (!question || !optionsRaw) {
            alert('Vui lòng nhập đầy đủ câu hỏi và danh sách đối tượng!');
            return;
        }

        btnSavePoll.disabled = true;
        btnSavePoll.innerText = 'Đang tạo...';

        let imageUrl = null;
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `poll_${roomId}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${roomId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(filePath, imageFile);

            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
                imageUrl = publicUrl;
            }
        }

        const options = optionsRaw.split(',').map((label, index) => ({
            id: (index + 1).toString(),
            label: label.trim()
        }));

        let criteria = [];
        if (type === 'matrix') {
            criteria = Array.from(document.querySelectorAll('.matrix-criterion'))
                .map((input, idx) => ({
                    id: `tc${idx + 1}`,
                    label: input.value.trim() || `Tiêu chí ${idx + 1}`
                }));
        }

        const { error } = await supabase
            .from('polls')
            .insert([{
                room_id: roomId,
                question: question,
                options: options,
                type: type,
                criteria: criteria,
                image_url: imageUrl,
                status: 'active'
            }]);

        btnSavePoll.disabled = false;
        btnSavePoll.innerText = 'Tạo bình chọn';

        if (error) {
            alert('Lỗi khi tạo poll: ' + error.message);
        } else {
            modalPoll.classList.add('hidden');
            resetPollForm();
            loadPolls();
        }
    });

    async function loadPolls() {
        const { data: polls } = await supabase
            .from('polls')
            .select('*, votes(option_id)')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false });

        renderPolls(polls || []);
    }

    function renderPolls(polls) {
        // Calculate total votes across all polls
        const totalVotesAll = polls.reduce((sum, p) => sum + (p.votes ? p.votes.length : 0), 0);
        statVoted.innerText = totalVotesAll;

        if (polls.length === 0) {
            pollList.innerHTML = '<div class="text-center text-gray-500 py-10">Chưa có cuộc bình chọn nào.</div>';
            return;
        }

        pollList.innerHTML = polls.map(poll => {
            const totalVotes = poll.votes.length;
            const voteCounts = {};
            poll.options.forEach(opt => voteCounts[opt.id] = 0);
            poll.votes.forEach(v => voteCounts[v.option_id]++);

            if (poll.type === 'matrix') {
                return renderMatrixResult(poll);
            }

            const optionsHtml = poll.options.map(opt => {
                const count = voteCounts[opt.id];
                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                return `
                    <div class="mb-4">
                        <div class="flex justify-between text-xs mb-1">
                            <span>${opt.label}</span>
                            <span class="font-bold text-primary">${count} phiếu (${percent}%)</span>
                        </div>
                        <div class="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                            <div class="bg-gradient-to-r from-primary to-secondary h-full transition-all duration-1000 ease-out" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="bg-white/5 border border-white/5 p-5 rounded-2xl mb-4 hover:border-white/10 transition-all overflow-hidden relative">
                    ${poll.status === 'closed' ? '<div class="absolute inset-0 bg-gray-900/40 z-0 pointer-events-none"></div>' : ''}
                    <div class="relative z-10">
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <h4 class="font-bold text-lg text-white mb-1">${poll.question}</h4>
                                <p class="text-[10px] text-gray-500 uppercase tracking-widest">Tổng: ${totalVotes} lượt bình chọn</p>
                            </div>
                            <span class="px-2 py-1 rounded-lg text-[9px] uppercase font-black tracking-tighter ${poll.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}">
                                ${poll.status === 'active' ? 'Đang mở' : 'Đã đóng'}
                            </span>
                        </div>
                        <div class="${poll.type === 'matrix' ? 'overflow-x-auto' : ''}">${optionsHtml}</div>
                        <div class="mt-6 pt-4 border-t border-white/5 flex gap-2">
                            <button onclick="togglePoll('${poll.id}', '${poll.status}')" class="text-[10px] bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-all font-semibold">
                                ${poll.status === 'active' ? 'Đóng cuộc bình chọn' : 'Mở lại'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderMatrixResult(poll) {
        const totalVotes = poll.votes.length;
        const criteria = poll.criteria || [];
        const candidates = poll.options || [];

        // Matrix structure: results[candidateId][criterionId] = sum
        const results = {};
        candidates.forEach(cand => {
            results[cand.id] = { total: 0, criteria: {} };
            criteria.forEach(crit => results[cand.id].criteria[crit.id] = 0);
        });

        poll.votes.forEach(vote => {
            const ms = vote.matrix_scores || {};
            Object.keys(ms).forEach(candId => {
                if (results[candId]) {
                    Object.keys(ms[candId]).forEach(critId => {
                        const score = ms[candId][critId] || 0;
                        results[candId].criteria[critId] += score;
                        results[candId].total += score;
                    });
                }
            });
        });

        // Sorting Logic: Total Score DESC, then TC3 (Criterion 3) DESC
        const sortedCandidates = candidates.map(cand => ({
            ...cand,
            total: results[cand.id].total,
            tc3: results[cand.id].criteria['tc3'] || 0
        })).sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            return b.tc3 - a.tc3;
        });

        const tableRows = sortedCandidates.map((cand, index) => {
            const isWinner = index === 0 && totalVotes > 0;
            const cellsHtml = criteria.map(crit => `
                <td class="px-2 py-3 text-center border-l border-white/5 font-mono text-xs">
                    ${results[cand.id].criteria[crit.id] || 0}
                </td>
            `).join('');

            return `
                <tr class="${isWinner ? 'bg-primary/10 border-l-4 border-l-primary' : 'bg-white/5 border-l-4 border-l-transparent'} border-b border-white/5">
                    <td class="px-4 py-3 text-sm font-medium text-white flex items-center gap-2">
                        ${isWinner ? '<i data-lucide="trophy" size="14" class="text-yellow-500"></i>' : ''}
                        ${cand.label}
                    </td>
                    ${cellsHtml}
                    <td class="px-4 py-3 text-center border-l border-white/5 text-primary font-bold">
                        ${cand.total}
                    </td>
                </tr>
            `;
        }).join('');

        const headerHtml = criteria.map(crit => `
            <th class="px-2 py-3 text-[10px] uppercase text-gray-400 border-l border-white/5 font-medium">${crit.label}</th>
        `).join('');

        return `
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-white/5">
                        <th class="px-4 py-3 text-[10px] uppercase text-gray-400 font-medium">Nhân sự</th>
                        ${headerHtml}
                        <th class="px-4 py-3 text-[10px] uppercase text-primary border-l border-white/5 font-bold">Tổng điểm</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            ${totalVotes > 0 ? `
                <div class="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 text-[10px] text-gray-500 italic">
                    * Quy tắc: Tổng điểm cao nhất là người được vinh danh. Nếu bằng điểm, ưu tiên nhân sự có điểm <strong>${criteria[2]?.label || 'Tiêu chí 3'}</strong> cao hơn.
                </div>
            ` : ''}
        `;
    }

    window.togglePoll = async (id, currentStatus) => {
        const nextStatus = currentStatus === 'active' ? 'closed' : 'active';
        const { error } = await supabase.from('polls').update({ status: nextStatus }).eq('id', id);
        if (error) alert('Lỗi: ' + error.message);
        loadPolls();
    }

    // Initial load
    loadPolls();

    // 8. Q&A Management
    const latestQuestions = document.getElementById('latestQuestions');

    async function loadQA() {
        const { data: questions } = await supabase
            .from('questions')
            .select('*')
            .eq('room_id', roomId)
            .order('upvotes', { ascending: false })
            .order('created_at', { ascending: false });

        renderQA(questions || []);
    }

    function renderQA(questions) {
        if (questions.length === 0) {
            latestQuestions.innerHTML = '<p class="text-center text-gray-600 text-sm mt-10">Đang chờ câu hỏi...</p>';
            return;
        }

        latestQuestions.innerHTML = questions.map(q => `
            <div class="bg-white/5 border border-white/5 p-3 rounded-xl mb-3 ${q.is_toxic ? 'border-red-500/30 bg-red-500/5' : ''} ${q.is_hidden ? 'opacity-40 grayscale' : ''} ${q.is_answered ? 'border-green-500/30 bg-green-500/5' : ''}">
                <div class="flex justify-between items-start gap-2">
                    <div class="flex-1">
                        ${q.is_answered ? '<span class="text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded-full uppercase font-bold mr-2 mb-1 inline-block">Đã trả lời</span>' : ''}
                        <p class="text-sm ${q.is_toxic ? 'text-red-300 italic' : 'text-gray-200'}">${q.content}</p>
                    </div>
                    <div class="flex flex-col items-center min-w-[30px]">
                        <i data-lucide="heart" size="12" class="text-primary" fill="currentColor"></i>
                        <span class="text-xs font-bold text-primary">${q.upvotes}</span>
                    </div>
                </div>
                <div class="mt-2 flex justify-between items-center">
                    <span class="text-[9px] text-gray-500">${new Date(q.created_at).toLocaleTimeString()}</span>
                    <div class="flex gap-2">
                        ${q.is_toxic ? `
                            <button onclick="approveQA('${q.id}')" class="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/20 hover:bg-green-500/30">Duyệt</button>
                        ` : ''}
                        <button onclick="markAsAnswered('${q.id}', ${q.is_answered})" class="text-[9px] ${q.is_answered ? 'bg-gray-500/20 text-gray-400' : 'bg-primary/20 text-primary'} px-2 py-0.5 rounded border border-white/10 hover:bg-white/10">
                            ${q.is_answered ? 'Bỏ đánh dấu' : 'Đã trả lời'}
                        </button>
                        <button onclick="toggleHideQA('${q.id}', ${q.is_hidden})" class="text-[9px] ${q.is_hidden ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'} px-2 py-0.5 rounded border border-white/10 hover:bg-white/10">
                            ${q.is_hidden ? 'Hiện lại' : 'Ẩn ý kiến'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }

    window.markAsAnswered = async (id, current) => {
        await supabase.from('questions').update({ is_answered: !current }).eq('id', id);
        loadQA();
    };

    window.toggleHideQA = async (id, current) => {
        await supabase.from('questions').update({ is_hidden: !current }).eq('id', id);
        loadQA();
    };

    window.approveQA = async (id) => {
        await supabase.from('questions').update({ is_toxic: false }).eq('id', id);
        loadQA();
    }

    // Initial load
    loadQA();

    // Update real-time listeners to include Questions
    supabase.channel('room_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `room_id=eq.${roomId}` }, () => loadPolls())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => loadPolls())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `room_id=eq.${roomId}` }, () => loadQA())
        .subscribe();

    // 4. Presence (Online Users)
    const roomChannel = supabase.channel(`room:${roomId}`);
    roomChannel
        .on('presence', { event: 'sync' }, () => {
            const newState = roomChannel.presenceState();
            statOnline.innerText = Object.keys(newState).length;
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await roomChannel.track({ online_at: new Date().toISOString() });
            }
        });

    // 5. Action Buttons
    const btnShare = document.getElementById('btnShare');
    const modalShare = document.getElementById('modalShare');
    const qrCode = document.getElementById('qrCode');
    const shareLinkInput = document.getElementById('shareLinkInput');
    const btnCloseShare = document.getElementById('btnCloseShare');
    const btnCopyLink = document.getElementById('btnCopyLink');

    if (btnShare) {
        btnShare.addEventListener('click', () => {
            const joinLink = `${window.location.origin}/participant.html?id=${activeShortId}`;
            shareLinkInput.value = joinLink;
            qrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinLink)}`;
            modalShare.classList.remove('hidden');
        });
    }

    if (btnCloseShare) {
        btnCloseShare.addEventListener('click', () => {
            modalShare.classList.add('hidden');
        });
    }

    if (btnCopyLink) {
        btnCopyLink.addEventListener('click', () => {
            navigator.clipboard.writeText(shareLinkInput.value).then(() => {
                alert('Đã copy link tham gia!');
            });
        });
    }

    // 6. Excel Export Logic
    const btnExportExcel = document.getElementById('btnExportExcel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', async () => {
            const { data: polls } = await supabase
                .from('polls')
                .select('*, votes(option_id)')
                .eq('room_id', roomId);

            if (!polls || polls.length === 0) {
                alert('Không có dữ liệu để xuất!');
                return;
            }

            const data = [];
            polls.forEach(poll => {
                const totalVotes = poll.votes.length;

                if (poll.type === 'matrix') {
                    const criteria = poll.criteria || [];
                    const candidates = poll.options || [];
                    const results = {};
                    candidates.forEach(cand => {
                        results[cand.id] = { total: 0, criteria: {} };
                        criteria.forEach(crit => results[cand.id].criteria[crit.id] = 0);
                    });

                    poll.votes.forEach(vote => {
                        const ms = vote.matrix_scores || {};
                        Object.keys(ms).forEach(candId => {
                            if (results[candId]) {
                                Object.keys(ms[candId]).forEach(critId => {
                                    const score = ms[candId][critId] || 0;
                                    results[candId].criteria[critId] += score;
                                    results[candId].total += score;
                                });
                            }
                        });
                    });

                    candidates.forEach(cand => {
                        const row = {
                            "Câu hỏi": poll.question,
                            "Đối tượng (Nhân sự)": cand.label,
                            "Loại": "Ma trận điểm",
                            "Trạng thái": poll.status === 'active' ? 'Đang mở' : 'Đã đóng'
                        };
                        criteria.forEach(crit => {
                            row[crit.label] = results[cand.id].criteria[crit.id] || 0;
                        });
                        row["TỔNG ĐIỂM"] = results[cand.id].total;
                        data.push(row);
                    });
                } else {
                    const voteCounts = {};
                    poll.options.forEach(opt => voteCounts[opt.id] = 0);
                    poll.votes.forEach(v => voteCounts[v.option_id]++);

                    poll.options.forEach(opt => {
                        const count = voteCounts[opt.id];
                        const percent = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(2) : 0;
                        data.push({
                            "Câu hỏi": poll.question,
                            "Lựa chọn": opt.label,
                            "Số phiếu": count,
                            "Tỷ lệ %": percent + "%",
                            "Loại": "Lựa chọn duy nhất",
                            "Trạng thái": poll.status === 'active' ? 'Đang mở' : 'Đã đóng'
                        });
                    });
                }
                // Add empty row between polls
                data.push({});
            });

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Kết quả bình chọn");
            XLSX.writeFile(wb, `Bao_cao_binh_chon_${roomId}.xlsx`);
        });
    }

    // 7. Image Upload Logic
    const inputBgImage = document.getElementById('inputBgImage');
    if (inputBgImage) {
        inputBgImage.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file size (e.g., 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('File quá lớn! Vui lòng chọn ảnh dưới 2MB.');
                return;
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `bg_${roomId}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${roomId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(filePath, file);

            if (uploadError) {
                alert('Lỗi khi tải ảnh lên: ' + uploadError.message);
                return;
            }

            // Show temporary loading indicator
            const imgBtn = inputBgImage.parentElement.querySelector('i');
            imgBtn.classList.add('animate-spin');

            const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('rooms')
                .update({ bg_url: publicUrl })
                .eq('id', roomId);

            imgBtn.classList.remove('animate-spin');

            if (updateError) {
                alert('Lỗi khi cập nhật ảnh nền!');
            } else {
                alert('Đã cập nhật ảnh nền thành công! Tải lại trang Landing Page để thấy thay đổi.');
                location.reload(); // Reload to show new bg
            }
        });
    }
    // 9. Resizable Panels Logic
    const resizer = document.getElementById('resizer');
    const panelLeft = document.getElementById('panelLeft');
    let isDragging = false;

    if (resizer && panelLeft) {
        resizer.addEventListener('mousedown', (e) => {
            isDragging = true;
            resizer.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const containerWidth = document.querySelector('.split-container').offsetWidth;
            let newWidth = (e.clientX / containerWidth) * 100;

            // Constrain width between 20% and 80%
            newWidth = Math.max(20, Math.min(80, newWidth));
            panelLeft.style.width = `${newWidth}%`;
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = 'default';
        });
    }

    // 10. Layout Presets Logic
    window.setLayoutPreset = (preset) => {
        const panelLeft = document.getElementById('panelLeft');
        const panelRight = document.getElementById('panelRight');

        // Update button states
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('bg-primary/20', 'text-primary', 'font-bold');
            btn.classList.add('bg-white/5', 'text-gray-400');
        });

        const activeBtn = Array.from(document.querySelectorAll('.preset-btn'))
            .find(btn => btn.innerText.toLowerCase().includes(preset === 'focus' ? 'tập trung' : preset === 'moderate' ? 'cân bằng' : 'phân tích'));

        if (activeBtn) {
            activeBtn.classList.remove('bg-white/5', 'text-gray-400');
            activeBtn.classList.add('bg-primary/20', 'text-primary', 'font-bold');
        }

        switch (preset) {
            case 'focus':
                panelLeft.style.width = '75%';
                panelRight.style.display = 'block';
                break;
            case 'moderate':
                panelLeft.style.width = '50%';
                panelRight.style.display = 'block';
                break;
            case 'analytic':
                panelLeft.style.width = '30%';
                panelRight.style.display = 'block';
                break;
        }
    };
});
