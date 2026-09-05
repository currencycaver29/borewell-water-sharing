
    // --- SEED DATA & CONSTANTS ---
    const SEED_FARMERS = [
      { id: 'f1', name: 'Member 01', acres: 5, pin: '1111' },
      { id: 'f2', name: 'Member 02', acres: 4, pin: '2222' },
      { id: 'f3', name: 'Member 03', acres: 3, pin: '3333' },
      { id: 'f4', name: 'Member 04', acres: 4, pin: '4444' },
      { id: 'f5', name: 'Member 05', acres: 3, pin: '5555' },
      { id: 'f6', name: 'Member 06', acres: 4, pin: '6666' },
      { id: 'f7', name: 'Member 07', acres: 4, pin: '7777' },
      { id: 'f8', name: 'Member 08', acres: 3, pin: '8888' }
    ];
    const TOTAL_ACRES = 30;
    const TOTAL_WEEKLY_HOURS = 56; // 8 hours per day, 7 days
    
    // --- STATE MANAGEMENT ---
    const app = {
      state: {
        farmers: [],
        slots: [],
        sessions: [],
        swapRequests: [],
        disputes: [],
        settings: { offlineMode: false, weekStartDate: null }
      },
      offlineQueue: [],
      currentUser: null,
      currentScreen: 'login',
      activeTimerInterval: null,
      
      init() {
        this.loadState();
        if (!this.state.farmers.length) {
          this.generateSeedData();
        } else {
          this.checkWeekRollover();
        }
        
        // Add keyboard support for PIN pad
        window.addEventListener('keydown', (e) => {
          if (this.currentScreen === 'pin') {
            if (e.key >= '0' && e.key <= '9') {
              this.appendPin(e.key);
            } else if (e.key === 'Backspace') {
              this.clearPin();
            }
          }
        });

        // Auto-login check
        const savedUser = localStorage.getItem('bw_currentUser');
        if (savedUser) {
          this.currentUser = this.state.farmers.find(f => f.id === savedUser);
          if(this.currentUser) {
            document.getElementById('main-header').classList.remove('hidden');
            document.getElementById('bottom-nav').classList.remove('hidden');
            this.updateBadges();
            this.navigate('roster');
            return;
          }
        }
        this.renderLogin();
      },

      loadState() {
        const stored = localStorage.getItem('bw_state');
        if (stored) this.state = JSON.parse(stored);
        
        const queue = localStorage.getItem('bw_offlineQueue');
        if (queue) this.offlineQueue = JSON.parse(queue);
      },

      saveState() {
        if (this.state.settings.offlineMode) {
          localStorage.setItem('bw_state', JSON.stringify(this.state));
          localStorage.setItem('bw_offlineQueue', JSON.stringify(this.offlineQueue));
          this.updateOfflineBanner();
        } else {
          localStorage.setItem('bw_state', JSON.stringify(this.state));
        }
        this.updateBadges();
      },
      
      queueAction(actionType, payload) {
        if (this.state.settings.offlineMode) {
          this.offlineQueue.push({ type: actionType, payload, timestamp: Date.now() });
          this.saveState();
        }
      },

      syncOfflineQueue() {
        this.offlineQueue = [];
        this.state.settings.offlineMode = false;
        this.saveState();
        this.updateOfflineBanner();
        this.renderSettings();
        alert('Offline changes synchronized with server.');
      },

      updateOfflineBanner() {
        const banner = document.getElementById('sync-banner');
        if (this.state.settings.offlineMode) {
          banner.classList.remove('hidden');
          document.getElementById('pending-count').innerText = this.offlineQueue.length;
        } else {
          banner.classList.add('hidden');
        }
      },

      generateSeedData() {
        this.state.farmers = SEED_FARMERS.map(f => {
          const allotted = (f.acres / TOTAL_ACRES) * TOTAL_WEEKLY_HOURS;
          return {
            id: f.id,
            name: f.name,
            totalAcres: f.acres,
            weeklyHoursAllotted: parseFloat(allotted.toFixed(2)),
            hoursUsed: 0,
            hoursOwed: 0,
            pin: f.pin
          };
        });
        this.generateWeeklySchedule();
      },

      getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0,0,0,0);
        return d;
      },

      generateWeeklySchedule() {
        const now = new Date();
        const startOfWeek = this.getStartOfWeek(now);
        this.state.settings.weekStartDate = startOfWeek.toISOString();
        
        this.state.slots = [];
        let currentSlotTime = new Date(startOfWeek);
        currentSlotTime.setHours(8, 0, 0, 0); 
        
        let dayCounter = 0;
        let farmerIdx = 0;
        let slotIdCounter = 1;

        while(dayCounter < 7) {
          let dailyHours = 0;
          while(dailyHours < 8) {
            let farmer = this.state.farmers[farmerIdx];
            let duration = 2; 
            
            this.state.slots.push({
              id: 's' + slotIdCounter++,
              farmerId: farmer.id,
              dayOfWeek: dayCounter,
              startTime: new Date(currentSlotTime).toISOString(),
              durationHours: duration,
              status: "scheduled"
            });
            
            currentSlotTime.setHours(currentSlotTime.getHours() + duration);
            dailyHours += duration;
            farmerIdx = (farmerIdx + 1) % this.state.farmers.length;
          }
          dayCounter++;
          currentSlotTime = new Date(startOfWeek);
          currentSlotTime.setDate(currentSlotTime.getDate() + dayCounter);
          currentSlotTime.setHours(8, 0, 0, 0);
        }
        
        this.saveState();
      },

      checkWeekRollover() {
        const now = new Date();
        const currentStartOfWeek = this.getStartOfWeek(now);
        const savedStartOfWeek = new Date(this.state.settings.weekStartDate);
        
        if (currentStartOfWeek > savedStartOfWeek) {
          this.state.farmers.forEach(f => { f.hoursUsed = 0; });
          this.generateWeeklySchedule();
        }
      },

      // --- NAVIGATION ---
      navigate(screen) {
        this.currentScreen = screen;
        
        document.querySelectorAll('.nav-item').forEach(el => {
          el.classList.toggle('active', el.dataset.tab === screen);
        });

        const content = document.getElementById('app-content');
        if(this.activeTimerInterval) clearInterval(this.activeTimerInterval);

        switch(screen) {
          case 'login': content.innerHTML = this.viewLogin(); break;
          case 'pin': content.innerHTML = this.viewPin(); break;
          case 'roster': this.renderRoster(); break;
          case 'pump': this.renderMyTurn(); break;
          case 'swap': this.renderSwap(); break;
          case 'disputes': this.renderDisputes(); break;
          case 'log': this.renderLog(); break;
          case 'settings': this.renderSettings(); break;
        }
      },
      
      updateBadges() {
        const myPendingSwaps = this.state.swapRequests.filter(s => s.toFarmerId === this.currentUser?.id && s.status === 'pending').length;
        const swapBadge = document.getElementById('swap-badge');
        if(myPendingSwaps > 0) {
           swapBadge.innerText = myPendingSwaps;
           swapBadge.classList.remove('hidden');
        } else { swapBadge.classList.add('hidden'); }

        const openDisputes = this.state.disputes.filter(d => d.status === 'open').length;
        const disputeBadge = document.getElementById('dispute-badge');
        if(openDisputes > 0) {
           disputeBadge.innerText = openDisputes;
           disputeBadge.classList.remove('hidden');
        } else { disputeBadge.classList.add('hidden'); }
      },

      // --- VIEWS ---
      
      // 1. LOGIN
      renderLogin() {
        this.navigate('login');
      },

      viewLogin() {
        document.getElementById('main-header').classList.add('hidden');
        document.getElementById('bottom-nav').classList.add('hidden');
        
        const farmerBtns = this.state.farmers.map(f => `
          <button class="farmer-btn" onclick="app.selectFarmer('${f.id}')">${f.name}</button>
        `).join('');

        return `
          <div style="text-align: center; margin-top: 40px;">
            <div style="background: var(--accent); color: white; width: 64px; height: 64px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
              <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
            </div>
            <h1 style="color: var(--text); margin-bottom: 8px; font-size: 26px;">Water Sharing Board</h1>
            <p class="text-gray" style="margin-bottom: 30px; font-size: 16px;">Select your name to log in</p>
            <div class="farmer-grid">${farmerBtns}</div>
          </div>
        `;
      },
      
      selectFarmer(id) {
        this.selectedFarmerForLogin = this.state.farmers.find(f => f.id === id);
        this.enteredPin = '';
        this.navigate('pin');
      },

      viewPin() {
        return `
          <div style="text-align: center; margin-top: 40px;">
            <h2 style="margin-bottom: 8px;">Hello, ${this.selectedFarmerForLogin.name}</h2>
            <p class="text-gray" style="margin-bottom: 24px;">Enter your 4-digit PIN (or type on keyboard)</p>
            
            <div class="pin-display">${this.enteredPin.padEnd(4, '•')}</div>
            
            <div class="pin-pad">
              ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="pin-btn" onclick="app.appendPin('${n}')">${n}</button>`).join('')}
              <button class="pin-btn" onclick="app.navigate('login')" style="background: var(--red); color: white; font-size: 16px; border: none;">BACK</button>
              <button class="pin-btn" onclick="app.appendPin('0')">0</button>
              <button class="pin-btn" onclick="app.clearPin()" style="background: var(--yellow); color: black; font-size: 16px; border: none;">DEL</button>
            </div>
          </div>
        `;
      },

      appendPin(digit) {
        if(this.enteredPin.length < 4) {
          this.enteredPin += digit;
          this.navigate('pin');
          if(this.enteredPin.length === 4) {
            setTimeout(() => this.verifyPin(), 200);
          }
        }
      },
      clearPin() {
        this.enteredPin = this.enteredPin.slice(0, -1);
        this.navigate('pin');
      },
      verifyPin() {
        if(this.enteredPin === this.selectedFarmerForLogin.pin) {
          this.currentUser = this.selectedFarmerForLogin;
          localStorage.setItem('bw_currentUser', this.currentUser.id);
          document.getElementById('main-header').classList.remove('hidden');
          document.getElementById('bottom-nav').classList.remove('hidden');
          this.updateBadges();
          this.navigate('roster');
        } else {
          alert('Incorrect PIN. Please try again.');
          this.enteredPin = '';
          this.navigate('pin');
        }
      },

      logout() {
        this.currentUser = null;
        localStorage.removeItem('bw_currentUser');
        this.navigate('login');
      },

      // 2. ROSTER
      renderRoster() {
        let html = `<h2>Weekly Roster</h2>`;
        
        html += `<div class="roster-summary-grid">`;
        this.state.farmers.forEach(f => {
          let pct = (f.hoursUsed / f.weeklyHoursAllotted) * 100;
          if (pct > 100) pct = 100;
          html += `
            <div class="summary-card" style="display: flex; align-items: center; gap: 12px; padding: 16px;">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(f.name)}&background=random&color=fff&rounded=true&size=44" alt="${f.name}" style="width: 44px; height: 44px; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.8);">
                <div style="flex: 1;">
                  <div class="flex-row" style="margin-bottom: 6px;">
                    <strong style="font-size: 15px;">${f.name}</strong>
                    <span class="text-gray" style="font-weight: 500; font-size: 13px; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">${f.hoursUsed.toFixed(1)} / ${f.weeklyHoursAllotted}h</span>
                  </div>
                  <div class="progress-bar" style="height: 6px; border-radius: 6px;">
                    <div class="progress-fill" style="width: ${pct}%; border-radius: 6px;"></div>
                  </div>
                </div>
              </div>
            </div>
          `;
        });
        html += `</div>`;

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const sortedSlots = [...this.state.slots].sort((a,b) => new Date(a.startTime) - new Date(b.startTime));

        for(let d=0; d<7; d++) {
          const daySlots = sortedSlots.filter(s => s.dayOfWeek === d);
          if (daySlots.length === 0) continue;
          
          const dateStr = new Date(daySlots[0].startTime).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});

          html += `<div class="roster-day"><h3>${days[d]} - ${dateStr}</h3>`;

          daySlots.forEach(slot => {
            const farmer = this.state.farmers.find(f => f.id === slot.farmerId);
            const start = new Date(slot.startTime);
            const end = new Date(start);
            end.setHours(end.getHours() + slot.durationHours);
            
            const timeStr = `${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            let statusBadge = '';
            if(slot.status === 'active') statusBadge = '<span class="badge active">Active</span>';
            else if(slot.status === 'scheduled') statusBadge = '<span class="badge pending">Scheduled</span>';
            else if(slot.status === 'completed') statusBadge = '<span class="badge">Completed</span>';
            else if(slot.status === 'missed' || slot.status === 'disputed') statusBadge = '<span class="badge disputed">Missed</span>';

            html += `
              <div class="slot-item ${slot.status}" onclick="alert('Slot Details:\\nFarmer: ${farmer.name}\\nTime: ${timeStr}\\nStatus: ${slot.status.toUpperCase()}')">
                <div>
                  <strong style="font-size: 16px;">${farmer.name}</strong><br>
                  <small class="text-gray" style="font-size: 14px;">${timeStr}</small>
                </div>
                <div>${statusBadge}</div>
              </div>
            `;
          });
          html += `</div>`;
        }

        document.getElementById('app-content').innerHTML = html;
      },

      // 3. MY TURN (PUMP)
      renderMyTurn() {
        const content = document.getElementById('app-content');
        let activeSession = this.state.sessions.find(s => s.farmerId === this.currentUser.id && !s.actualEnd);
        
        if (activeSession) {
          this.renderActivePump(content, activeSession);
          return;
        }

        const now = new Date();
        const upcomingSlots = this.state.slots
          .filter(s => s.farmerId === this.currentUser.id && s.status === 'scheduled')
          .sort((a,b) => new Date(a.startTime) - new Date(b.startTime));

        if (upcomingSlots.length === 0) {
          content.innerHTML = `
            <h2>My Turn</h2>
            <div class="card" style="text-align: center; padding: 60px 20px;">
              <div style="font-size: 50px; margin-bottom: 20px; opacity: 0.5;"><svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5; color:var(--text-light);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
              <h3 class="text-gray">No upcoming turns scheduled.</h3>
              <p class="text-gray" style="font-size: 14px;">Check the Roster to see when you are next scheduled.</p>
            </div>
          `;
          return;
        }

        const nextSlot = upcomingSlots[0];
        const slotStart = new Date(nextSlot.startTime);
        const timeDiffMins = (slotStart - now) / (1000 * 60);
        let buttonHtml = '';
        
        const isSomeoneElseActive = this.state.slots.some(s => s.status === 'active');

        if (isSomeoneElseActive) {
           const activeSlot = this.state.slots.find(s => s.status === 'active');
           const activeFarmer = this.state.farmers.find(f => f.id === activeSlot.farmerId);
           buttonHtml = `
             <div class="flashing-banner" style="background: var(--yellow); color: #b45309; box-shadow: none;">
               Pump is currently in use by ${activeFarmer.name}
             </div>
             <button disabled>Start Pumping</button>
           `;
        } else if (timeDiffMins <= 15) {
           buttonHtml = `<button class="btn-green" onclick="app.startPump('${nextSlot.id}')">Start Pumping Now</button>`;
        } else {
           buttonHtml = `
             <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; text-align: center; color: var(--text-light); margin-top: 20px; border: 1px solid var(--border);">
               You can start pumping 15 minutes before your scheduled time.
             </div>
             <button disabled style="margin-top: 12px;">Start Pumping</button>
           `;
        }

        content.innerHTML = `
          <h2>My Turn</h2>
          <div class="card">
            <h3 style="color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 10px;">Next Scheduled Turn</h3>
            <div style="margin: 16px 0; font-size: 16px;">
              <div style="margin-bottom: 8px;"><strong>Date:</strong> ${slotStart.toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'})}</div>
              <div style="margin-bottom: 8px;"><strong>Time:</strong> ${slotStart.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</div>
              <div style="margin-bottom: 8px;"><strong>Duration:</strong> ${nextSlot.durationHours} hours</div>
            </div>
            ${buttonHtml}
          </div>
        `;
      },

      renderActivePump(container, session) {
        const slot = this.state.slots.find(s => s.id === session.slotId);
        
        const updateTimer = () => {
          const now = new Date();
          let elapsedMs = 0;
          
          if (session.powerCutActiveSince) {
            elapsedMs = new Date(session.powerCutActiveSince) - new Date(session.actualStart) - (session.powerCutMinutes * 60000);
          } else {
            elapsedMs = now - new Date(session.actualStart) - (session.powerCutMinutes * 60000);
          }
          
          if(elapsedMs < 0) elapsedMs = 0;
          
          const hrs = Math.floor(elapsedMs / 3600000);
          const mins = Math.floor((elapsedMs % 3600000) / 60000);
          const secs = Math.floor((elapsedMs % 60000) / 1000);
          
          const el = document.getElementById('pump-timer');
          if(el) {
            el.innerText = `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
          }
        };

        let activeHtml = `<h2>Active Pump Session</h2>`;
        
        if (session.powerCutActiveSince) {
          activeHtml += `
            <div class="flashing-banner">POWER CUT ACTIVE</div>
            <div class="card" style="text-align: center; border: 2px solid var(--red); background-color: #fef2f2;">
              <div class="text-red" style="font-weight: 600; margin-bottom: 10px; text-transform: uppercase;">Pump Stopped</div>
              <div class="timer-display text-red" id="pump-timer">00:00:00</div>
              <p style="color: var(--red); font-size: 14px; margin-bottom: 20px;">Net Pumping Time (Paused)</p>
              <button class="btn-yellow" onclick="app.resumePump('${session.id}')">Resume Pumping</button>
            </div>
          `;
        } else {
          activeHtml += `
            <div class="card" style="text-align: center; border: 2px solid var(--green); background-color: #f0fdf4;">
              <div class="text-green" style="font-weight: 700; font-size: 18px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Pumping Now</div>
              <div class="timer-display text-green" id="pump-timer" style="color: #15803d;">00:00:00</div>
              <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 20px;">
                <button class="btn-red" onclick="app.powerCut('${session.id}')">Report Power Cut</button>
                <button class="btn-secondary" onclick="app.endTurn('${session.id}')">End Turn</button>
              </div>
            </div>
          `;
        }

        activeHtml += `
          <div class="card">
            <h3>Turn Details</h3>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding: 10px 0;">
              <span class="text-gray">Scheduled Time</span>
              <strong>${slot.durationHours} hours</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0;">
              <span class="text-gray">Power Cut Downtime</span>
              <strong>${session.powerCutMinutes} minutes</strong>
            </div>
          </div>
        `;

        container.innerHTML = activeHtml;
        updateTimer();
        this.activeTimerInterval = setInterval(updateTimer, 1000);
      },

      forceEndOtherTurn(activeSlotId) {
        if(!confirm("Are you sure you want to forcefully terminate their pump session? This will log an alert.")) return;
        
        // Find the active session for the offending farmer
        const activeSession = this.state.sessions.find(s => s.slotId === activeSlotId && !s.actualEnd);
        if (activeSession) {
          activeSession.actualEnd = new Date().toISOString();
          
          const totalMs = new Date(activeSession.actualEnd) - new Date(activeSession.actualStart);
          const netMs = totalMs - (activeSession.powerCutMinutes * 60000);
          let netHours = netMs / 3600000;
          if(netHours < 0) netHours = 0;
          
          const farmer = this.state.farmers.find(f => f.id === activeSession.farmerId);
          farmer.hoursUsed += netHours;
          
          const slot = this.state.slots.find(s => s.id === activeSlotId);
          slot.status = 'completed';
          
          // Auto-file a dispute
          const d = {
            id: 'disp_' + Date.now(),
            reportedBy: 'SYSTEM',
            againstFarmerId: farmer.id,
            reason: 'Overrun (Forcefully Terminated by next farmer)',
            status: 'open',
            createdAt: new Date().toISOString()
          };
          this.state.disputes.push(d);
        }
        
        this.saveState();
        alert('Turn forcefully ended. You may now start your pump.');
        this.renderMyTurn();
      },

      startPump(slotId) {
        const slot = this.state.slots.find(s => s.id === slotId);
        slot.status = 'active';
        
        const newSession = {
          id: 'sess_' + Date.now(),
          slotId: slotId,
          farmerId: this.currentUser.id,
          actualStart: new Date().toISOString(),
          actualEnd: null,
          powerCutMinutes: 0,
          powerCutActiveSince: null
        };
        
        this.state.sessions.push(newSession);
        this.queueAction('startPump', { slotId, sessionId: newSession.id });
        this.saveState();
        this.renderMyTurn();
      },

      powerCut(sessionId) {
        const session = this.state.sessions.find(s => s.id === sessionId);
        session.powerCutActiveSince = new Date().toISOString();
        const slot = this.state.slots.find(s => s.id === session.slotId);
        slot.status = 'interrupted';
        
        this.queueAction('powerCut', { sessionId });
        this.saveState();
        this.renderMyTurn();
      },

      resumePump(sessionId) {
        const session = this.state.sessions.find(s => s.id === sessionId);
        const now = new Date();
        const downMs = now - new Date(session.powerCutActiveSince);
        session.powerCutMinutes += Math.floor(downMs / 60000);
        session.powerCutActiveSince = null;
        
        const slot = this.state.slots.find(s => s.id === session.slotId);
        slot.status = 'active';

        this.queueAction('resumePump', { sessionId });
        this.saveState();
        this.renderMyTurn();
      },

      endTurn(sessionId) {
        if(!confirm("Are you sure you want to completely stop pumping and end your turn?")) return;
        
        const session = this.state.sessions.find(s => s.id === sessionId);
        session.actualEnd = new Date().toISOString();
        
        const slot = this.state.slots.find(s => s.id === session.slotId);
        slot.status = 'completed';

        const totalMs = new Date(session.actualEnd) - new Date(session.actualStart);
        const netMs = totalMs - (session.powerCutMinutes * 60000);
        let netHours = netMs / 3600000;
        if(netHours < 0) netHours = 0;

        const farmer = this.state.farmers.find(f => f.id === this.currentUser.id);
        farmer.hoursUsed += netHours;
        
        const scheduledHours = slot.durationHours;
        if (netHours < scheduledHours) {
          farmer.hoursOwed += (scheduledHours - netHours);
        }

        this.queueAction('endTurn', { sessionId, netHours });
        this.saveState();
        if(this.activeTimerInterval) clearInterval(this.activeTimerInterval);
        this.navigate('log');
      },

      // 4. SWAPS
      renderSwap() {
        let html = `<h2>Swap Requests</h2>`;
        
        const pendingForMe = this.state.swapRequests.filter(s => s.toFarmerId === this.currentUser.id && s.status === 'pending');
        
        if (pendingForMe.length > 0) {
          html += `<h3 style="color: var(--accent);">Action Required</h3>`;
          pendingForMe.forEach(swap => {
            const fromFarmer = this.state.farmers.find(f => f.id === swap.fromFarmerId);
            const mySlot = this.state.slots.find(s => s.id === swap.toSlotId);
            const theirSlot = this.state.slots.find(s => s.id === swap.fromSlotId);
            if (!mySlot || !theirSlot) return; // Skip rendering obsolete swaps
            
            html += `
              <div class="card" style="border-left: 4px solid var(--yellow)">
                <p style="font-size: 16px;"><strong>${fromFarmer.name}</strong> wants to swap turns with you.</p>
                <div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin: 12px 0; border: 1px solid var(--border);">
                  <div style="margin-bottom: 8px;"><strong style="color: var(--red);">You Give Up:</strong><br> ${new Date(mySlot.startTime).toLocaleString([],{weekday:'long', hour:'2-digit', minute:'2-digit'})} (${mySlot.durationHours}h)</div>
                  <div><strong style="color: var(--green);">You Take:</strong><br> ${new Date(theirSlot.startTime).toLocaleString([],{weekday:'long', hour:'2-digit', minute:'2-digit'})} (${theirSlot.durationHours}h)</div>
                </div>
                <div class="flex-row" style="gap: 12px;">
                  <button class="btn-secondary" style="margin-top: 0;" onclick="app.rejectSwap('${swap.id}')">Reject</button>
                  <button class="btn-green" style="margin-top: 0;" onclick="app.acceptSwap('${swap.id}')">Accept Swap</button>
                </div>
              </div>
            `;
          });
        }

        html += `
          <h3 style="margin-top: 24px;">Request a Swap</h3>
          <div class="card">
            <label style="font-weight: 600; font-size: 14px; color: var(--text-light);">1. Select your slot to give away:</label>
            <select id="swap-my-slot" style="margin-bottom: 20px;">
              <option value="">-- Choose your slot --</option>
              ${this.state.slots.filter(s => s.farmerId === this.currentUser.id && s.status === 'scheduled').map(s => 
                `<option value="${s.id}">${new Date(s.startTime).toLocaleString([],{weekday:'short', hour:'2-digit'})} (${s.durationHours}h)</option>`
              ).join('')}
            </select>

            <label style="font-weight: 600; font-size: 14px; color: var(--text-light);">2. Select the farmer you want to swap with:</label>
            <select id="swap-target-farmer" onchange="app.onTargetFarmerChange()" style="margin-bottom: 20px;">
              <option value="">-- Choose a farmer --</option>
              ${this.state.farmers.filter(f => f.id !== this.currentUser.id).map(f => 
                `<option value="${f.id}">${f.name}</option>`
              ).join('')}
            </select>

            <label style="font-weight: 600; font-size: 14px; color: var(--text-light);">3. Select their slot you want to take:</label>
            <select id="swap-their-slot" style="margin-bottom: 10px;">
              <option value="">-- Select farmer first --</option>
            </select>
            
            <button class="btn-accent" style="margin-top: 24px;" onclick="app.submitSwapRequest()">Send Swap Request</button>
          </div>
        `;

        document.getElementById('app-content').innerHTML = html;
      },

      onTargetFarmerChange() {
        const targetId = document.getElementById('swap-target-farmer').value;
        const selectTheir = document.getElementById('swap-their-slot');
        if(!targetId) {
          selectTheir.innerHTML = '<option value="">-- Select farmer first --</option>';
          return;
        }
        
        const slots = this.state.slots.filter(s => s.farmerId === targetId && s.status === 'scheduled');
        selectTheir.innerHTML = slots.map(s => 
          `<option value="${s.id}">${new Date(s.startTime).toLocaleString([],{weekday:'short', hour:'2-digit'})} (${s.durationHours}h)</option>`
        ).join('');
      },

      submitSwapRequest() {
        const mySlotId = document.getElementById('swap-my-slot').value;
        const targetFarmerId = document.getElementById('swap-target-farmer').value;
        const theirSlotId = document.getElementById('swap-their-slot').value;
        
        if(!mySlotId || !targetFarmerId || !theirSlotId) {
          alert("Please fill out all fields."); return;
        }

        const req = {
          id: 'swap_' + Date.now(),
          fromFarmerId: this.currentUser.id,
          toFarmerId: targetFarmerId,
          fromSlotId: mySlotId,
          toSlotId: theirSlotId,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        this.state.swapRequests.push(req);
        this.queueAction('requestSwap', req);
        this.saveState();
        alert('Swap request sent to the farmer!');
        this.navigate('swap');
      },

      acceptSwap(swapId) {
        const swap = this.state.swapRequests.find(s => s.id === swapId);
        swap.status = 'accepted';
        
        const mySlot = this.state.slots.find(s => s.id === swap.toSlotId);
        const theirSlot = this.state.slots.find(s => s.id === swap.fromSlotId);
        
        if (!mySlot || !theirSlot || mySlot.status !== 'scheduled' || theirSlot.status !== 'scheduled') {
          alert('Cannot complete swap because one of these turns has already passed or been deleted.');
          swap.status = 'rejected';
          this.saveState();
          this.renderSwap();
          return;
        }
        
        if (mySlot.farmerId !== this.currentUser.id || theirSlot.farmerId !== swap.fromFarmerId) {
          alert('Cannot complete swap because one of these slots has already been swapped with someone else.');
          alert('Cannot complete swap because one of these turns has already passed.');
          swap.status = 'rejected';
          this.saveState();
          this.renderSwap();
          return;
        }

        const tempId = mySlot.farmerId;
        mySlot.farmerId = theirSlot.farmerId;
        theirSlot.farmerId = tempId;

        const myFarmer = this.state.farmers.find(f => f.id === this.currentUser.id);
        const theirFarmer = this.state.farmers.find(f => f.id === swap.fromFarmerId);
        
        const myNetChange = theirSlot.durationHours - mySlot.durationHours;
        const theirNetChange = mySlot.durationHours - theirSlot.durationHours;
        
        myFarmer.hoursOwed -= myNetChange;
        theirFarmer.hoursOwed -= theirNetChange;

        this.queueAction('acceptSwap', { swapId });
        this.saveState();
        this.renderSwap();
      },

      rejectSwap(swapId) {
        const swap = this.state.swapRequests.find(s => s.id === swapId);
        swap.status = 'rejected';
        this.queueAction('rejectSwap', { swapId });
        this.saveState();
        this.renderSwap();
      },

      // 5. DISPUTES
      renderDisputes() {
        let html = `<h2>Alerts & Issues</h2>`;
        
        const openDisputes = this.state.disputes.filter(d => d.status === 'open');
        
        if (openDisputes.length > 0) {
          openDisputes.forEach(d => {
            const reportedBy = this.state.farmers.find(f => f.id === d.reportedBy)?.name || 'Unknown';
            const against = this.state.farmers.find(f => f.id === d.againstFarmerId)?.name || 'Unknown';
            html += `
              <div class="card" style="border-left: 4px solid var(--red);">
                <div class="flex-row" style="margin-bottom: 8px;">
                  <strong class="text-red" style="font-size: 16px;"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> ${d.reason}</strong>
                  <span class="text-gray" style="font-size: 12px;">${new Date(d.createdAt).toLocaleDateString()}</span>
                </div>
                <div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border); font-size: 14px;">
                  Issue reported against <strong>${against}</strong>.<br>
                  <span style="color: var(--text-light); font-size: 13px;">Reported by: ${reportedBy}</span>
                </div>
                <button class="btn-secondary" onclick="app.resolveDispute('${d.id}')">Mark as Resolved</button>
              </div>
            `;
          });
        } else {
          html += `
            <div class="card" style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 40px; margin-bottom: 16px; opacity: 0.5;"><svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5; color:var(--green);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
              <h3 class="text-gray">No active issues.</h3>
              <p class="text-gray" style="font-size: 14px;">The board is clear.</p>
            </div>
          `;
        }

        html += `
          <h3 style="margin-top:32px;">Report a Problem</h3>
          <div class="card">
            <label style="font-weight: 600; font-size: 14px; color: var(--text-light);">Select Farmer:</label>
            <select id="disp-farmer" style="margin-bottom: 20px;">
              ${this.state.farmers.filter(f => f.id !== this.currentUser.id).map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
            </select>
            
            <label style="font-weight: 600; font-size: 14px; color: var(--text-light);">Select the Problem:</label>
            <select id="disp-reason" style="margin-bottom: 10px;">
              <option value="Overrun (Pump not turned off)">Overrun (Pump not turned off)</option>
              <option value="No-show (Wasting time)">No-show (Wasting time)</option>
              <option value="Stolen Turn (Turned on out of schedule)">Stolen Turn (Turned on out of schedule)</option>
              <option value="Other">Other Problem</option>
            </select>
            
            <button class="btn-red" style="margin-top:24px;" onclick="app.submitDispute()">Submit Alert to Board</button>
          </div>
        `;
        document.getElementById('app-content').innerHTML = html;
      },

      submitDispute() {
        const against = document.getElementById('disp-farmer').value;
        const reason = document.getElementById('disp-reason').value;
        
        const d = {
          id: 'disp_' + Date.now(),
          reportedBy: this.currentUser.id,
          againstFarmerId: against,
          reason: reason,
          status: 'open',
          createdAt: new Date().toISOString()
        };
        
        this.state.disputes.push(d);
        this.queueAction('flagDispute', d);
        this.saveState();
        alert('Problem reported to the board successfully.');
        this.renderDisputes();
      },
      
      resolveDispute(id) {
        if(!confirm("Are you sure this issue is resolved?")) return;
        const d = this.state.disputes.find(x => x.id === id);
        d.status = 'resolved';
        this.queueAction('resolveDispute', { id });
        this.saveState();
        this.renderDisputes();
      },

      // 6. LOG
      renderLog() {
        let html = `<h2>Pumping History</h2>`;
        
        const completedSessions = this.state.sessions.filter(s => s.actualEnd).sort((a,b) => new Date(b.actualStart) - new Date(a.actualStart));
        
        if (completedSessions.length === 0) {
          html += `
            <div class="card" style="text-align: center; padding: 40px 20px;">
              <h3 class="text-gray">No pumping history yet.</h3>
              <p class="text-gray" style="font-size: 14px;">Completed turns will appear here.</p>
            </div>
          `;
        }

        completedSessions.forEach(session => {
          const farmer = this.state.farmers.find(f => f.id === session.farmerId);
          const slot = this.state.slots.find(s => s.id === session.slotId);
          
          const start = new Date(session.actualStart);
          const end = new Date(session.actualEnd);
          const totalMins = Math.floor((end - start) / 60000);
          const netMins = totalMins - session.powerCutMinutes;
          const netHours = (netMins / 60).toFixed(1);

          html += `
            <div class="card">
              <div class="flex-row" style="border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 12px;">
                <strong style="font-size: 16px;">${farmer.name}</strong>
                <span class="text-gray" style="font-size: 13px;">${start.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
              </div>
              <div style="font-size: 14px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between;">
                  <span class="text-gray">Actual Time:</span>
                  <span>${start.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span class="text-gray">Power Cuts:</span>
                  <span>${session.powerCutMinutes} minutes</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border);">
                  <span class="text-gray">Net Pumped:</span>
                  <strong style="color: var(--accent); font-size: 16px;">${netHours} hours</strong>
                </div>
              </div>
            </div>
          `;
        });
        document.getElementById('app-content').innerHTML = html;
      },

      // 7. SETTINGS
      renderSettings() {
        document.getElementById('app-content').innerHTML = `
          <h2>Settings</h2>
          
          <div class="card">
            <h3 style="color: var(--text-light); font-size: 14px; text-transform: uppercase;">Connection Simulator</h3>
            
            <div class="flex-row" style="margin-top: 16px;">
              <span>
                <strong style="font-size: 16px;">Offline Mode</strong><br>
                <small class="text-gray">Simulate no internet connection</small>
              </span>
              <label style="position: relative; display: inline-block; width: 50px; height: 28px;">
                <input type="checkbox" id="offline-toggle" style="opacity: 0; width: 0; height: 0;" ${this.state.settings.offlineMode ? 'checked' : ''} onchange="app.toggleOffline()">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${this.state.settings.offlineMode ? 'var(--accent)' : '#ccc'}; border-radius: 34px; transition: .4s;">
                  <span style="position: absolute; content: ''; height: 20px; width: 20px; left: ${this.state.settings.offlineMode ? '26px' : '4px'}; bottom: 4px; background-color: white; border-radius: 50%; transition: .4s;"></span>
                </span>
              </label>
            </div>
          </div>
          
          <div class="card">
            <h3 style="color: var(--text-light); font-size: 14px; text-transform: uppercase;">Account</h3>
            <button class="btn-secondary" style="margin-top: 8px;" onclick="app.logout()">Log Out / Switch Farmer</button>
          </div>

          <div class="card">
            <h3 style="color: var(--text-light); font-size: 14px; text-transform: uppercase;">Admin Controls</h3>
            <button class="btn-secondary" onclick="app.exportCSV()">Download Log Data (CSV)</button>
            <button class="btn-red" style="margin-top:16px; opacity: 0.9;" onclick="app.hardReset()">Hard Reset System</button>
            <p style="text-align: center; margin-top: 16px; font-size: 12px; color: var(--text-light);">Prototype v2.0</p>
          </div>
        `;
      },

      toggleOffline() {
        const toggle = document.getElementById('offline-toggle');
        this.state.settings.offlineMode = toggle.checked;
        if (!this.state.settings.offlineMode && this.offlineQueue.length > 0) {
          this.updateOfflineBanner();
        }
        this.saveState();
        this.updateOfflineBanner();
        this.renderSettings(); // Re-render to update toggle visually
      },

      exportCSV() {
        let csv = "Farmer,Date,Start,End,ScheduledHours,NetHours,PowerCutMins\n";
        const completedSessions = this.state.sessions.filter(s => s.actualEnd);
        
        completedSessions.forEach(session => {
          const farmer = this.state.farmers.find(f => f.id === session.farmerId);
          const slot = this.state.slots.find(s => s.id === session.slotId);
          const start = new Date(session.actualStart);
          const end = new Date(session.actualEnd);
          const totalMins = Math.floor((end - start) / 60000);
          const netMins = totalMins - session.powerCutMinutes;
          const netHours = (netMins / 60).toFixed(2);
          
          csv += `${farmer.name},${start.toLocaleDateString()},${start.toLocaleTimeString()},${end.toLocaleTimeString()},${slot?slot.durationHours:''},${netHours},${session.powerCutMinutes}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', 'borewell_log.csv');
        a.click();
      },

      hardReset() {
        const pin = prompt("Enter Admin PIN (0000) to wipe all data:");
        if (pin === '0000') {
          localStorage.clear();
          location.reload();
        } else if (pin) {
          alert('Incorrect Admin PIN.');
        }
      }
    };

    // Initialize App
    window.onload = () => app.init();
  