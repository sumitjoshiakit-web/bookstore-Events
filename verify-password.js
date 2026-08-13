/**
 * Vercel Serverless Function
 * Password never exposed to GitHub! 
 */

export default async function handler(req, res) {
    // ✅ Only POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed. Use POST.' 
        });
    }

    try {
        const { password } = req.body;

        // ✅ Password from environment variable
        const adminPassword = process.env.ADMIN_PASSWORD;

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
