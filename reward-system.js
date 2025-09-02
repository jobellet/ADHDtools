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
    const pointsDisplay = document.getElementById('points-display');
    const rewardNameInput = document.getElementById('reward-name');
    const rewardPointsInput = document.getElementById('reward-points');
    const addRewardBtn = document.getElementById('add-reward-btn');
    const claimRewardBtn = document.getElementById('claim-reward-btn');
    const confettiCanvas = document.getElementById('confetti-canvas');
    
    // Load rewards and points from localStorage
    let rewards = JSON.parse(localStorage.getItem('adhd-rewards')) || [];
    let points = parseInt(localStorage.getItem('adhd-points')) || 0;
    let achievements = JSON.parse(localStorage.getItem('adhd-achievements')) || [];
    
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
    
    // Render rewards list
    function renderRewards() {
        // Clear current list
        rewardsList.innerHTML = '';
        
        // Update points display
        if (pointsDisplay) {
            pointsDisplay.textContent = points;
        }
        
        // Create reward elements
        rewards.forEach((reward, index) => {
            const rewardItem = document.createElement('div');
            rewardItem.className = 'reward-item';
            
            // Create reward name
            const rewardName = document.createElement('div');
            rewardName.className = 'reward-name';
            rewardName.textContent = reward.name;
            
            // Create reward points
            const rewardPoints = document.createElement('div');
            rewardPoints.className = 'reward-points';
            rewardPoints.textContent = `${reward.points} points`;
            
            // Create claim button
            const claimBtn = document.createElement('button');
            claimBtn.className = 'claim-btn';
            claimBtn.textContent = 'Claim';
            claimBtn.disabled = points < reward.points;
            claimBtn.addEventListener('click', function() {
                claimReward(index);
            });
            
            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', function() {
                deleteReward(index);
            });
            
            // Assemble reward item
            rewardItem.appendChild(rewardName);
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
        
        // Sort achievements by date (newest first)
        const sortedAchievements = [...achievements].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });
        
        // Create achievement elements
        sortedAchievements.forEach((achievement) => {
            const achievementItem = document.createElement('div');
            achievementItem.className = 'achievement-item';
            
            // Create achievement icon
            const achievementIcon = document.createElement('div');
            achievementIcon.className = 'achievement-icon';
            achievementIcon.innerHTML = '🏆';
            
            // Create achievement details
            const achievementDetails = document.createElement('div');
            achievementDetails.className = 'achievement-details';
            
            // Create achievement name
            const achievementName = document.createElement('div');
            achievementName.className = 'achievement-name';
            achievementName.textContent = achievement.name;
            
            // Create achievement date
            const achievementDate = document.createElement('div');
            achievementDate.className = 'achievement-date';
            achievementDate.textContent = new Date(achievement.date).toLocaleDateString();
            
            // Assemble achievement details
            achievementDetails.appendChild(achievementName);
            achievementDetails.appendChild(achievementDate);
            
            // Assemble achievement item
            achievementItem.appendChild(achievementIcon);
            achievementItem.appendChild(achievementDetails);
            
            achievementsList.appendChild(achievementItem);
        });
    }
    
    // Add new reward
    function addReward() {
        const name = rewardNameInput.value.trim();
        const pointsValue = parseInt(rewardPointsInput.value);
        
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
            points: pointsValue,
            createdAt: new Date().toISOString()
        };
        
        rewards.push(newReward);
        saveRewards();
        
        // Clear inputs
        rewardNameInput.value = '';
        rewardPointsInput.value = '';
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
        
        if (points < reward.points) {
            alert('Not enough points to claim this reward');
            return;
        }
        
        if (confirm(`Are you sure you want to claim "${reward.name}" for ${reward.points} points?`)) {
            // Deduct points
            points -= reward.points;
            
            // Add to achievements
            const achievement = {
                name: `Claimed: ${reward.name}`,
                date: new Date().toISOString(),
                type: 'reward'
            };
            
            achievements.push(achievement);
            
            // Save changes
            localStorage.setItem('adhd-points', points);
            localStorage.setItem('adhd-achievements', JSON.stringify(achievements));
            
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
        points += amount;
        localStorage.setItem('adhd-points', points);
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
        
        // Update points and achievements if any were earned
        if (newPoints > 0) {
            points += newPoints;
            achievements = achievements.concat(newAchievements);
            
            localStorage.setItem('adhd-points', points);
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
    
    // Check for points to award on page load
    checkForPointsToAward();
});
