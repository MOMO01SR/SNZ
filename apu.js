// --- إعدادات الاتصال بقاعدة بيانات SNZ ---
const supabaseUrl = 'https://yebcshcdjbwzlpujpkjx.supabase.co';
const supabaseKey = 'sb_publishable_LOJTDkfGK0Xe5_lNlWNduQ_X16ToqeJ';

// تهيئة الاتصال
const _supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
console.log('...SYSTEM: DATABASE NODE CONNECTED SUCCESSFULLY');

// --- نظام فحص الصيانة الشامل ---
async function checkGlobalMaintenance() {
    try {
        // 1. التأكد من توفر مكتبة Supabase أولاً
        if (!window.supabase) {
            console.error("خطأ: لم يتم تحميل مكتبة Supabase بنجاح.");
            return;
        }

        // 2. جلب حالة الصيانة من قاعدة البيانات
        const { data, error } = await _supabase.from('settings').select('is_maintenance').single();
        if (error) throw error;

        // 3. تحديد مسار الزائر وتخطي الإدارة
        const path = window.location.pathname.toLowerCase();
        const isAdmin = path.includes('admin'); // أو اسم ملف لوحة التحكم الخاص بك

        if (data && data.is_maintenance) {
            if (isAdmin) {
                console.log("Admin Bypass: تم تخطي فحص الصيانة للإدارة.");
            } else {
                // طرد المستخدمين العاديين لصفحة الصيانة
                window.location.replace('/maintenance.html');
            }
        }
    } catch (err) {
        console.error("System Check Failed:", err.message);
    }
}

// تشغيل الفحص فور فتح الصفحة
checkGlobalMaintenance();
