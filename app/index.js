<!-- دايلوج المصادقة المعدّل -->
<div class="modal-overlay" id="authModal">
    <div class="auth-modal-content">
        <div class="modal-drag-indicator"></div>
        
        <!-- Tabs: دخول / حساب جديد -->
        <div style="display:flex; gap:0; margin-bottom:24px; background:#f1f5f9; border-radius:12px; padding:4px;">
            <button id="loginTab" onclick="switchAuthTab('login')" 
                    style="flex:1; padding:10px; border:none; border-radius:10px; font-weight:700; font-family:inherit; cursor:pointer; background:#fff; color:var(--primary); box-shadow:var(--shadow-sm);">
                تسجيل الدخول
            </button>
            <button id="signupTab" onclick="switchAuthTab('signup')" 
                    style="flex:1; padding:10px; border:none; border-radius:10px; font-weight:700; font-family:inherit; cursor:pointer; background:transparent; color:var(--text-muted);">
                حساب جديد
            </button>
        </div>

        <div class="auth-header">
            <h3 id="authTitle">مرحباً بعودتك 👋</h3>
            <p id="authSubtitle">سجّل دخولك لمتابعة حجوزاتك</p>
        </div>

        <div class="social-auth-buttons">
            <button class="btn-social google-btn" onclick="loginWithGoogle()">
                <svg class="social-icon" viewBox="0 0 48 48">...</svg>
                <span>المتابعة بواسطة Google</span>
            </button>
            <button class="btn-social facebook-btn" onclick="loginWithFacebook()">
                <i class="fa-brands fa-facebook-f" style="font-size:20px;"></i>
                <span>المتابعة بواسطة Facebook</span>
            </button>
        </div>

        <div class="auth-divider"><span>أو عبر البريد الإلكتروني</span></div>

        <input type="text" id="authName" class="input-field" placeholder="الاسم الكامل" style="display:none;">
        <input type="email" id="authEmail" class="input-field" placeholder="البريد الإلكتروني">
        <input type="password" id="authPassword" class="input-field" placeholder="كلمة المرور">
        
        <button id="authSubmitBtn" class="btn-submit-luxury" onclick="handleEmailAuth(false)">
            دخول
        </button>
    </div>
</div>
