<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolInformation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SchoolInformationController extends Controller
{
    public function show()
    {
        $info = SchoolInformation::first();
        if (!$info) {
            return response()->json([]);
        }

        // Return a RELATIVE path for the logo
        $info->logo_url = $info->logo ? 'storage/' . $info->logo : null;

        return response()->json($info);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'school_name'       => 'required|string|max:255',
            'email_primary'     => 'nullable|email|max:255',
            'email_secondary'   => 'nullable|email|max:255',
            'phone_primary'     => 'nullable|string|max:20',
            'phone_secondary'   => 'nullable|string|max:20',
            'postal_address'    => 'nullable|string|max:500',
            'website'           => 'nullable|url|max:255',
            'headteacher_name'  => 'nullable|string|max:255',
            'motto'             => 'nullable|string|max:500',
            'logo'              => 'nullable|image|mimes:jpg,jpeg,png|max:2048',
            'remove_logo'       => 'nullable|string',    // ← changed from boolean
        ]);

        $info = SchoolInformation::firstOrNew([]);

        // Handle logo upload
        if ($request->hasFile('logo')) {
            if ($info->logo) {
                Storage::disk('public')->delete($info->logo);
            }
            $path = $request->file('logo')->store('school', 'public');
            $validated['logo'] = $path;
        }

        // Handle logo removal (convert string "true"/"false" to boolean)
        if (filter_var($request->input('remove_logo'), FILTER_VALIDATE_BOOLEAN)) {
            if ($info->logo) {
                Storage::disk('public')->delete($info->logo);
            }
            $validated['logo'] = null;
        }

        // Remove remove_logo from validated before saving
        unset($validated['remove_logo']);

        $info->fill($validated)->save();

        // Return with full logo URL
        $info->logo_url = $info->logo ? url('storage/' . $info->logo) : null;

        return response()->json($info);
    }
}
