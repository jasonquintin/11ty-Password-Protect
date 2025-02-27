const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SITE_PASSWORD = 'mihra'; // The password required to decrypt
const PASSWORD_EXPIRY_DAYS = 5; // Number of days to remember the password

console.log('🔒 StaticCrypt Plugin: File loaded');

function encrypt(content) {
    console.log('Encrypting content...');
    // Use consistent key and IV lengths that Web Crypto API expects
    const key = crypto.pbkdf2Sync(SITE_PASSWORD, 'salt', 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12); // 12 bytes for GCM
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = cipher.update(content, 'utf8');
    const final = cipher.final();
    const tag = cipher.getAuthTag();

    // Return Base64 strings
    return {
        encrypted: Buffer.concat([encrypted, final]).toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        salt: 'salt' // We use a constant salt for simplicity
    };
}

module.exports = function(eleventyConfig) {
    eleventyConfig.addTransform("encrypt-page", function(content) {
        if (!this.outputPath || typeof this.outputPath !== 'string' || !this.outputPath.endsWith('.html')) {
            return content;
        }

        // Only encrypt HTML files that have the PROTECT comment
        if (!content.includes('<!--PROTECT-->')) {
            return content;
        }

        console.log('🔒 Processing protected page:', this.outputPath);

        try {
            const cleanContent = content.replace('<!--PROTECT-->', '');
            const encrypted = encrypt(cleanContent);
            
            const outputDir = path.dirname(this.outputPath);
            const encryptedPath = path.join(outputDir, 'index.encrypted.json');
            
            fs.mkdirSync(outputDir, { recursive: true });
            console.log('Writing encrypted data to:', encryptedPath);
            fs.writeFileSync(encryptedPath, JSON.stringify(encrypted, null, 2));
            
            return `<!DOCTYPE html>
<html>
<head>
    <title>Protected Content</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            margin: 0;
            padding: 2rem;
            font-family: system-ui, -apple-system, sans-serif;
            background: #f5f5f5;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .container {
            max-width: 600px;
            width: 100%;
            margin: 2rem auto;
        }
        .form-group {
            margin-bottom: 1rem;
        }
        input[type="password"] {
            padding: 0.75rem;
            width: 100%;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 1rem;
        }
        #decryptButton {
            padding: 0.75rem 1rem;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            width: 100%;
            transition: background-color 0.2s;
        }
        #decryptButton:hover {
            background: #1d4ed8;
        }
        #status {
            margin-top: 1rem;
            padding: 1rem;
            background: #fff;
            border-radius: 4px;
            width: 100%;
            display: none;
        }
        .remember-me {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 1rem 0;
        }
        .error { background: #fee2e2; color: #991b1b; }
        .success { background: #dcfce7; color: #166534; }
        #loginForm { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Protected Content</h1>
        <div id="loginForm">
            <div class="form-group">
                <input type="password" id="password" placeholder="Enter password" />
            </div>
            <div class="remember-me">
                <input type="checkbox" id="rememberMe" />
                <label for="rememberMe">Remember me for ${PASSWORD_EXPIRY_DAYS} days</label>
            </div>
            <button id="decryptButton">View Content</button>
            <div id="status"></div>
        </div>
    </div>

    <script>
    (function() {
        const status = document.getElementById('status');
        const passwordInput = document.getElementById('password');
        const rememberMe = document.getElementById('rememberMe');
        const loginForm = document.getElementById('loginForm');
        const EXPIRY_DAYS = ${PASSWORD_EXPIRY_DAYS};
        
        function showStatus(message, type = '') {
            status.textContent = message;
            status.style.display = 'block';
            status.className = type ? type : '';
            console.log(message);
        }

        // Function to save password with expiration
        function savePassword(password) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS);
            
            const passwordData = {
                value: password,
                expires: expiryDate.getTime()
            };
            
            localStorage.setItem('protectedPassword', JSON.stringify(passwordData));
        }

        // Function to get saved password
        function getSavedPassword() {
            const passwordData = localStorage.getItem('protectedPassword');
            if (!passwordData) return null;
            
            try {
                const { value, expires } = JSON.parse(passwordData);
                if (Date.now() > expires) {
                    localStorage.removeItem('protectedPassword');
                    return null;
                }
                return value;
            } catch (e) {
                localStorage.removeItem('protectedPassword');
                return null;
            }
        }

        async function decryptContent(password) {
            showStatus('Loading encrypted content...');
            
            try {
                // Load encrypted data
                const response = await fetch('index.encrypted.json');
                if (!response.ok) throw new Error('Failed to load encrypted data');
                const encryptedData = await response.json();
                showStatus('Data loaded, preparing decryption...');

                // Convert Base64 to ArrayBuffer
                function base64ToArrayBuffer(base64) {
                    const binary_string = window.atob(base64);
                    const bytes = new Uint8Array(binary_string.length);
                    for (let i = 0; i < binary_string.length; i++) {
                        bytes[i] = binary_string.charCodeAt(i);
                    }
                    return bytes;
                }

                // Derive key from password
                const encoder = new TextEncoder();
                const passwordBuffer = encoder.encode(password);
                const salt = encoder.encode(encryptedData.salt);
                
                const baseKey = await window.crypto.subtle.importKey(
                    'raw',
                    passwordBuffer,
                    'PBKDF2',
                    false,
                    ['deriveKey']
                );
                
                const key = await window.crypto.subtle.deriveKey(
                    {
                        name: 'PBKDF2',
                        salt: salt,
                        iterations: 100000,
                        hash: 'SHA-256'
                    },
                    baseKey,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['decrypt']
                );

                showStatus('Decrypting content...');

                // Get the encrypted content components
                const iv = base64ToArrayBuffer(encryptedData.iv);
                const encrypted = base64ToArrayBuffer(encryptedData.encrypted);
                const tag = base64ToArrayBuffer(encryptedData.tag);

                // Combine encrypted data and tag
                const combined = new Uint8Array(encrypted.length + tag.length);
                combined.set(encrypted);
                combined.set(tag, encrypted.length);

                try {
                    // Decrypt
                    const decrypted = await window.crypto.subtle.decrypt(
                        {
                            name: 'AES-GCM',
                            iv: iv,
                            tagLength: 128
                        },
                        key,
                        combined.buffer
                    );

                    // Save password if remember me is checked
                    if (rememberMe.checked) {
                        savePassword(password);
                    }

                    // Replace page content
                    const decoder = new TextDecoder();
                    document.documentElement.innerHTML = decoder.decode(decrypted);
                    
                    // Re-run scripts
                    Array.from(document.getElementsByTagName('script')).forEach(script => {
                        if (!script.src) {
                            eval(script.textContent);
                        }
                    });

                    return true;
                } catch (error) {
                    console.error('Decryption failed:', error);
                    showStatus('Incorrect password', 'error');
                    return false;
                }
            } catch (error) {
                console.error('Error:', error);
                showStatus('Failed to decrypt content: ' + error.message, 'error');
                return false;
            }
        }

        // Check for saved password and try to decrypt immediately
        async function init() {
            const savedPassword = getSavedPassword();
            if (savedPassword) {
                const success = await decryptContent(savedPassword);
                if (!success) {
                    // If decryption fails, clear saved password and show login form
                    localStorage.removeItem('protectedPassword');
                    loginForm.style.display = 'block';
                }
            } else {
                // No saved password, show login form
                loginForm.style.display = 'block';
            }
        }

        // Handle form submission
        document.getElementById('decryptButton').addEventListener('click', () => {
            decryptContent(passwordInput.value);
        });
        
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                decryptContent(passwordInput.value);
            }
        });

        // Initialize the page
        init();
    })();
    </script>
</body>
</html>`;
        } catch (error) {
            console.error('Encryption failed:', error);
            return content;
        }
    });
};