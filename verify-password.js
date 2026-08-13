/**
 * Vercel Serverless Function
 * Password verification API - Password GitHub pe nahi dikhega
 */

export default async function handler(req, res) {
    // ✅ Only POST requests allow karo
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed. Use POST.' 
        });
    }

    try {
        var body = req.body;
        var password = body.password;

        // ✅ Password environment variable se aayega
        // Vercel dashboard mein ADMIN_PASSWORD set karna hoga
        var adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        // ✅ Password match karo
        if (password === adminPassword) {
            return res.status(200).json({ 
                valid: true,
                message: 'Password verified successfully'
            });
        } else {
            return res.status(401).json({ 
                valid: false, 
                error: 'Invalid password' 
            });
        }
    } catch (error) {
        console.error('Password verification error:', error);
        return res.status(500).json({ 
            valid: false, 
            error: 'Internal server error' 
        });
    }
}
