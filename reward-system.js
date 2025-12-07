// Rewards System Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the rewards page
    if (!document.querySelector('.rewards-container')) return;

    // Toggle for "Add New Reward" form
    const toggleRewardsSetupBtn = document.getElementById('toggle-rewards-setup-btn');
    const rewardsSetupPanel = document.getElementById('rewards-setup-panel');

    if (toggleRewardsSetupBtn && rewardsSetupPanel) {
        toggleRewardsSetupBtn.addEventListener('click', function() {
            const isHidden = rewardsSetupPanel.classList.toggle('hidden');
            toggleRewardsSetupBtn.setAttribute('aria-expanded', String(!isHidden));
            // Optionally, change button text/icon if desired
            // e.g., this.innerHTML = isHidden ? '<i class="fas fa-plus"></i> Add New Reward' : '<i class="fas fa-times"></i> Cancel';
        });
    }

    const rewardsList = document.getElementById('rewards-list');
    const achievementsList = document.getElementById('achievements-list');
    const activityBox = document.getElementById('recent-activity');
    const pointsDisplay = document.getElementById('points-display');
    const pointsEarnedDisplay = document.getElementById('points-earned');
    const pointsSpentDisplay = document.getElementById('points-spent');
    const rewardNameInput = document.getElementById('reward-name');
    const rewardDescriptionInput = document.getElementById('reward-description');
    const rewardPointsInput = document.getElementById('reward-points');
    const rewardIconInput = document.getElementById('reward-icon');
    const addRewardBtn = document.getElementById('add-reward-btn');
    const claimRewardBtn = document.getElementById('claim-reward-btn');
    const confettiCanvas = document.getElementById('confetti-canvas');
    
    // Load rewards and points from localStorage
    let rewards = JSON.parse(localStorage.getItem('adhd-rewards')) || [];
    let achievements = JSON.parse(localStorage.getItem('adhd-achievements')) || [];
    const LEDGER_KEY = 'adhd-points-ledger';
    let ledger = {};
    let showAllUsers = false;

    function loadLedger() {
        try {
            const saved = localStorage.getItem(LEDGER_KEY);
            ledger = saved ? JSON.parse(saved) : {};
        } catch (err) {
            console.warn('Unable to load ledger', err);
            ledger = {};
        }
    }

    function saveLedger() {
        localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    }

    function getActiveLedger() {
        const user = window.UserContext?.getActiveUser?.() || 'main';
        if (!ledger[user]) ledger[user] = { bonus: 0, spent: 0 };
        return ledger[user];
    }

    loadLedger();
    
    // Initialize confetti
    let confetti = null;
    if (confettiCanvas) {
        confetti = {
            maxCount: 150,
            speed: 3,
            particles: [],
            colors: ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'],
            
            init: function() {
                this.ctx = confettiCanvas.getContext('2d');
                this.resize();
                window.addEventListener('resize', () => this.resize());
            },
            
            resize: function() {
                confettiCanvas.width = window.innerWidth;
                confettiCanvas.height = window.innerHeight;
            },
            
            createParticle: function() {
                const size = Math.random() * 10 + 5;
                return {
                    x: Math.random() * confettiCanvas.width,
                    y: -size,
                    size: size,
                    color: this.colors[Math.floor(Math.random() * this.colors.length)],
                    speed: Math.random() * this.speed + 1,
                    angle: Math.random() * 2 * Math.PI,
                    rotation: Math.random() * 360,
                    rotationSpeed: Math.random() * 10 - 5
                };
            },
            
            update: function() {
                // Add new particles if needed
                while (this.particles.length < this.maxCount) {
                    this.particles.push(this.createParticle());
                }
                
                // Clear canvas
                this.ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
                
                // Update and draw particles
                for (let i = 0; i < this.particles.length; i++) {
                    const p = this.particles[i];
                    
                    // Update position
                    p.y += p.speed;
                    p.x += Math.sin(p.angle) * 2;
                    p.rotation += p.rotationSpeed;
                    
                    // Remove if out of bounds
                    if (p.y > confettiCanvas.height) {
                        this.particles.splice(i, 1);
                        i--;
                        continue;
                    }
                    
                    // Draw particle
                    this.ctx.save();
                    this.ctx.translate(p.x, p.y);
                    this.ctx.rotate(p.rotation * Math.PI / 180);
                    this.ctx.fillStyle = p.color;
                    this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    this.ctx.restore();
                }
                
                // Continue animation
                requestAnimationFrame(() => this.update());
            },
            
            start: function() {
                confettiCanvas.style.display = 'block';
                this.particles = [];
                this.update();
                
                // Stop after 3 seconds
                setTimeout(() => {
                    confettiCanvas.style.display = 'none';
                }, 3000);
            }
        };
        
        confetti.init();
    }

    function getAchievementTotals() {
        const activeUser = showAllUsers ? null : window.UserContext?.getActiveUser?.();
        if (window.TaskStore?.getTaskScoreTotals) return window.TaskStore.getTaskScoreTotals(activeUser);
        const totalScore = achievements.reduce((sum, a) => sum + (a.points || 0), 0);
        return { groups: [], totalScore };
    }

    function getAvailablePoints() {
        const totals = getAchievementTotals();
        const ledgerEntry = getActiveLedger();
        return Math.max(0, Number((totals.totalScore + ledgerEntry.bonus - ledgerEntry.spent).toFixed(2)));
    }

    function renderLedger() {
        const totals = getAchievementTotals();
        const ledgerEntry = getActiveLedger();
        if (pointsDisplay) pointsDisplay.textContent = getAvailablePoints();
        if (pointsEarnedDisplay) pointsEarnedDisplay.textContent = totals.totalScore.toFixed(2);
        if (pointsSpentDisplay) pointsSpentDisplay.textContent = `${ledgerEntry.spent.toFixed(2)} (bonus: ${ledgerEntry.bonus?.toFixed?.(2) || '0.00'})`;
    }

    function getRecentStats(days = 1) {
        const tasks = window.TaskStore?.getAllTasks?.() || [];
        const activeUser = window.UserContext?.getActiveUser?.();
        const filtered = activeUser ? tasks.filter(t => t.user === activeUser) : tasks;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const completed = filtered.filter(t => t.completed && t.completedAt && new Date(t.completedAt).getTime() >= cutoff);
        const earned = completed.reduce((sum, task) => {
            const score = task.achievementScore || window.TaskModel?.computeAchievementScore?.(task) || 0;
            return sum + score;
        }, 0);
        return { count: completed.length, points: Number(earned.toFixed(2)) };
    }
    
    // Render rewards list
    function renderRewards() {
        // Clear current list
        rewardsList.innerHTML = '';

        renderLedger();
        
        // Create reward elements
        rewards.forEach((reward, index) => {
            const rewardItem = document.createElement('div');
            rewardItem.className = 'reward-item';

            const rewardIcon = document.createElement('div');
            rewardIcon.className = 'reward-icon';
            rewardIcon.textContent = reward.icon || '🎁';

            // Create reward info container
            const info = document.createElement('div');
            info.className = 'reward-info';

            const rewardName = document.createElement('div');
            rewardName.className = 'reward-name';
            rewardName.textContent = reward.name;

            const rewardDesc = document.createElement('div');
            rewardDesc.className = 'reward-description';
            rewardDesc.textContent = reward.description || '';

            info.appendChild(rewardName);
            if (reward.description) {
                info.appendChild(rewardDesc);
            }

            const rewardPoints = document.createElement('div');
            rewardPoints.className = 'reward-points';
            rewardPoints.textContent = `${reward.points} points`;

            const claimBtn = document.createElement('button');
            claimBtn.className = 'claim-btn';
            claimBtn.textContent = 'Claim';
            claimBtn.disabled = getAvailablePoints() < reward.points;
            claimBtn.addEventListener('click', function() {
                claimReward(index);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', function() {
                deleteReward(index);
            });

            rewardItem.appendChild(rewardIcon);
            rewardItem.appendChild(info);
            rewardItem.appendChild(rewardPoints);
            rewardItem.appendChild(claimBtn);
            rewardItem.appendChild(deleteBtn);

            rewardsList.appendChild(rewardItem);
        });
    }
    
    // Render achievements list
    function renderAchievements() {
        // Clear current list
        if (!achievementsList) return;

        achievementsList.innerHTML = '';

        const totals = getAchievementTotals();
        const sortedAchievements = totals.groups.sort((a, b) => b.score - a.score);

        const toggle = document.createElement('button');
        toggle.className = 'btn btn-secondary btn-small';
        toggle.textContent = showAllUsers ? 'Showing all users' : 'Showing active user';
        toggle.addEventListener('click', () => {
            showAllUsers = !showAllUsers;
            renderAchievements();
            renderRewards();
        });

        const header = document.createElement('div');
        header.className = 'achievement-summary';
        const activeUser = window.UserContext?.getActiveUser?.();
        header.textContent = showAllUsers ? 'Achievements for all users' : (activeUser ? `Achievements for ${activeUser}` : 'Achievements');
        header.appendChild(toggle);
        achievementsList.appendChild(header);

        sortedAchievements.forEach((achievement) => {
            const achievementItem = document.createElement('div');
            achievementItem.className = 'achievement-item';

            const achievementIcon = document.createElement('div');
            achievementIcon.className = 'achievement-icon';
            achievementIcon.innerHTML = '🏆';

            const achievementDetails = document.createElement('div');
            achievementDetails.className = 'achievement-details';

            const achievementName = document.createElement('div');
            achievementName.className = 'achievement-name';
            achievementName.textContent = `${achievement.name} – ${achievement.count} completed`;

            const achievementDate = document.createElement('div');
            achievementDate.className = 'achievement-date';
            achievementDate.textContent = `${achievement.score.toFixed(2)} pts`;

            achievementDetails.appendChild(achievementName);
            achievementDetails.appendChild(achievementDate);

            achievementItem.appendChild(achievementIcon);
            achievementItem.appendChild(achievementDetails);

            achievementsList.appendChild(achievementItem);
        });

        const totalsRow = document.createElement('div');
        totalsRow.className = 'achievement-item total-achievements';
        totalsRow.textContent = `Total points earned: ${totals.totalScore.toFixed(2)} | Available: ${getAvailablePoints()}`;
        achievementsList.appendChild(totalsRow);

        // Category breakdown with time spent
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'achievement-summary';
        categoryHeader.textContent = 'Top categories';
        achievementsList.appendChild(categoryHeader);

        const categories = (window.TaskStore?.getCategoryStats?.({ user: showAllUsers ? null : activeUser }) || [])
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        if (!categories.length) {
            const empty = document.createElement('div');
            empty.className = 'achievement-item';
            empty.textContent = 'No completed tasks yet.';
            achievementsList.appendChild(empty);
        } else {
            categories.forEach(cat => {
                const row = document.createElement('div');
                row.className = 'achievement-item';
                row.innerHTML = `<strong>${cat.name}</strong> — ${cat.count} tasks • ${cat.score.toFixed(2)} pts • ${cat.minutes} mins`;
                achievementsList.appendChild(row);
            });
        }

        if (activityBox) {
            const todayStats = getRecentStats(1);
            const weekStats = getRecentStats(7);
            activityBox.innerHTML = `Recent activity — Today: ${todayStats.count} tasks, ${todayStats.points} pts. Last 7 days: ${weekStats.count} tasks, ${weekStats.points} pts.`;
        }

        renderLedger();
    }
    
    // Add new reward
    function addReward() {
        const name = rewardNameInput.value.trim();
        const description = rewardDescriptionInput.value.trim();
        const pointsValue = parseInt(rewardPointsInput.value);
        const icon = rewardIconInput.value.trim();
        
        if (!name) {
            alert('Please enter a reward name');
            return;
        }
        
        if (isNaN(pointsValue) || pointsValue <= 0) {
            alert('Please enter a valid point value');
            return;
        }
        
        const newReward = {
            name,
            description,
            icon,
            points: pointsValue,
            createdAt: new Date().toISOString()
        };
        
        rewards.push(newReward);
        saveRewards();
        
        // Clear inputs
        rewardNameInput.value = '';
        rewardDescriptionInput.value = '';
        rewardPointsInput.value = '';
        rewardIconInput.value = '';
    }
    
    // Delete reward
    function deleteReward(index) {
        if (confirm('Are you sure you want to delete this reward?')) {
            rewards.splice(index, 1);
            saveRewards();
        }
    }
    
    // Claim reward
    function claimReward(index) {
        const reward = rewards[index];

        if (getAvailablePoints() < reward.points) {
            alert('Not enough points to claim this reward');
            return;
        }
        
        if (confirm(`Are you sure you want to claim "${reward.name}" for ${reward.points} points?`)) {
            const ledgerEntry = getActiveLedger();
            ledgerEntry.spent += reward.points;
            ledger[window.UserContext?.getActiveUser?.() || 'main'] = ledgerEntry;
            saveLedger();

            // Show celebration
            if (confetti) {
                confetti.start();
            }
            
            // Show confirmation
            alert(`Congratulations! You've claimed "${reward.name}". Enjoy your reward!`);
            
            // Update UI
            renderRewards();
            renderAchievements();
        }
    }

    // Add points (for testing or manual addition)
    function addPoints(amount) {
        const ledgerEntry = getActiveLedger();
        ledgerEntry.bonus += amount;
        ledger[window.UserContext?.getActiveUser?.() || 'main'] = ledgerEntry;
        saveLedger();
        renderRewards();
    }
    
    // Save rewards to localStorage
    function saveRewards() {
        localStorage.setItem('adhd-rewards', JSON.stringify(rewards));
        renderRewards();
    }
    
    // Event listeners
    if (addRewardBtn) {
        addRewardBtn.addEventListener('click', addReward);
    }
    
    if (rewardNameInput && rewardPointsInput) {
        rewardNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                rewardPointsInput.focus();
            }
        });
        
        rewardPointsInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addReward();
            }
        });
    }
    
    // Add points button (for testing)
    const addPointsBtn = document.getElementById('add-points-btn');
    if (addPointsBtn) {
        addPointsBtn.addEventListener('click', function() {
            addPoints(10);
        });
    }
    
    // Check for completed tasks and pomodoros to award points
    function checkForPointsToAward() {
        // Check for completed tasks
        const tasks = JSON.parse(localStorage.getItem('adhd-tasks')) || [];
        const lastPointsCheck = localStorage.getItem('last-points-check') || '2000-01-01T00:00:00.000Z';
        
        let newPoints = 0;
        let newAchievements = [];
        
        // Award points for tasks completed since last check
        tasks.forEach(task => {
            if (task.completed && new Date(task.completedAt) > new Date(lastPointsCheck)) {
                // Award points based on priority
                let taskPoints = 0;
                switch (task.priority) {
                    case 'high':
                        taskPoints = 5;
                        break;
                    case 'medium':
                        taskPoints = 3;
                        break;
                    case 'low':
                        taskPoints = 1;
                        break;
                    default:
                        taskPoints = 2;
                }
                
                newPoints += taskPoints;
                
                // Add achievement
                newAchievements.push({
                    name: `Completed task: ${task.text}`,
                    date: task.completedAt,
                    type: 'task',
                    points: taskPoints
                });
            }
        });
        
        // Check for completed pomodoro sessions
        const pomodoroSessions = JSON.parse(localStorage.getItem('pomodoro-sessions')) || [];
        
        pomodoroSessions.forEach(session => {
            if (session.completed && new Date(session.endTime) > new Date(lastPointsCheck)) {
                // Award 2 points per completed focus session
                newPoints += 2;
                
                // Add achievement
                newAchievements.push({
                    name: 'Completed a focus session',
                    date: session.endTime,
                    type: 'pomodoro',
                    points: 2
                });
            }
        });

        // Check habit streaks
        const habitLogs = JSON.parse(localStorage.getItem('adhd-habit-logs')) || {};
        const habits = JSON.parse(localStorage.getItem('adhd-habits')) || [];
        let streakAwards = JSON.parse(localStorage.getItem('adhd-habit-streak-awards')) || {};

        function calculateStreak(logs) {
            if (!logs) return 0;
            let streak = 0;
            let checkDate = new Date();
            const todayStr = checkDate.toISOString().split('T')[0];
            if (!logs[todayStr]) {
                checkDate.setDate(checkDate.getDate() - 1);
            }
            while (true) {
                const dateStr = checkDate.toISOString().split('T')[0];
                if (logs[dateStr]) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }
            return streak;
        }

        habits.forEach(habit => {
            const streak = calculateStreak(habitLogs[habit.id]);
            const lastAward = streakAwards[habit.id] || 0;
            if (streak >= 7 && streak > lastAward) {
                newPoints += 5;
                newAchievements.push({
                    name: `7-day streak for ${habit.text}`,
                    date: new Date().toISOString(),
                    type: 'habit',
                    points: 5
                });
                streakAwards[habit.id] = streak;
            }
        });
        localStorage.setItem('adhd-habit-streak-awards', JSON.stringify(streakAwards));
        
        // Update points and achievements if any were earned
        if (newPoints > 0) {
            const ledgerEntry = getActiveLedger();
            ledgerEntry.bonus += newPoints;
            ledger[window.UserContext?.getActiveUser?.() || 'main'] = ledgerEntry;
            saveLedger();
            achievements = achievements.concat(newAchievements);

            localStorage.setItem('adhd-achievements', JSON.stringify(achievements));
            localStorage.setItem('last-points-check', new Date().toISOString());
            
            // Update UI
            renderRewards();
            renderAchievements();
            
            // Notify user
            alert(`You've earned ${newPoints} points for your recent accomplishments!`);
        } else {
            // Update last check time even if no points were earned
            localStorage.setItem('last-points-check', new Date().toISOString());
        }
    }
    
    // Initial render
    renderRewards();
    renderAchievements();

    window.addEventListener('activeUserChanged', () => {
        renderRewards();
        renderAchievements();
    });

    if (window.EventBus) {
        window.EventBus.addEventListener('taskCompleted', () => {
            renderRewards();
            renderAchievements();
        });
        window.EventBus.addEventListener('dataChanged', () => {
            renderRewards();
            renderAchievements();
        });
    }
    
    // Check for points to award on page load
    checkForPointsToAward();
});
