{{-- resources/views/vendor/notifications/email.blade.php --}}
@php
    // Fetch school information once per email
    $school = \App\Models\SchoolInformation::first();
    $schoolName = $school->school_name ?? config('app.name', 'School Management System');
    $logoUrl = $school && $school->logo ? url('storage/' . $school->logo) : null;
    $motto = $school->motto ?? '';
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject ?? 'Notification' }}</title>
    <style>
        /* Base Reset */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }

        body {
            margin: 0;
            padding: 0;
            background-color: #f1f5f9;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
        }

        .email-wrapper {
            max-width: 560px;
            margin: 0 auto;
            padding: 50px 20px;
        }

        .email-card {
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }

        /* Header */
        .email-header {
            background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
            padding: 40px 30px 30px;
            text-align: center;
        }
        .email-header img {
            height: 56px;
            margin-bottom: 16px;
        }
        .email-header .school-name {
            color: #ffffff;
            font-size: 26px;
            font-weight: 700;
            margin: 0 0 6px;
            letter-spacing: -0.3px;
        }
        .email-header .motto {
            color: #bfdbfe;
            font-size: 14px;
            font-style: italic;
            margin: 0;
        }

        /* Body */
        .email-body {
            padding: 35px 30px;
            color: #1e293b;
            font-size: 16px;
            line-height: 1.7;
        }
        .greeting {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #0f172a;
        }
        .email-body p {
            margin: 0 0 16px;
        }
        .email-body .outro {
            margin-top: 30px;
            font-size: 14px;
            color: #64748b;
        }
        .email-body .salutation {
            margin-top: 20px;
            font-size: 14px;
            color: #64748b;
        }

        /* Action Button */
        .action-wrapper {
            text-align: center;
            margin: 30px 0 20px;
        }
        .action-button {
            display: inline-block;
            padding: 14px 36px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 16px;
            letter-spacing: 0.2px;
            box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
            transition: box-shadow 0.2s;
        }
        .action-button:hover {
            box-shadow: 0 15px 25px -5px rgba(37, 99, 235, 0.4);
        }

        /* Divider */
        .divider {
            border: 0;
            border-top: 1px solid #e2e8f0;
            margin: 30px 0 0;
        }

        /* Footer */
        .email-footer {
            padding: 25px 30px;
            background-color: #f8fafc;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
        }
        .email-footer a {
            color: #2563eb;
            text-decoration: none;
        }
        .email-footer p {
            margin: 4px 0;
        }

        /* Responsive */
        @media only screen and (max-width: 600px) {
            .email-wrapper { padding: 20px 10px; }
            .email-header, .email-body, .email-footer { padding-left: 20px; padding-right: 20px; }
            .email-header .school-name { font-size: 22px; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-card">
            <!-- Header -->
            <div class="email-header">
                @if ($logoUrl)
                    <img src="{{ $logoUrl }}" alt="{{ $schoolName }}" style="max-width: 200px;">
                @else
                    <h1 style="margin-bottom: 12px; color: #ffffff; font-size: 32px;">🎓</h1>
                @endif
                <h1 class="school-name">{{ $schoolName }}</h1>
                @if ($motto)
                    <p class="motto">{{ $motto }}</p>
                @endif
            </div>

            <!-- Body -->
            <div class="email-body">
                @if (! empty($greeting))
                    <p class="greeting">{{ $greeting }}</p>
                @else
                    @if ($level === 'error')
                        <p class="greeting">Whoops!</p>
                    @else
                        <p class="greeting">Hello!</p>
                    @endif
                @endif

                {{-- Intro Lines --}}
                @foreach ($introLines as $line)
                    <p>{{ $line }}</p>
                @endforeach

                {{-- Action Button --}}
                @isset($actionText)
                    <div class="action-wrapper">
                        <a href="{{ $actionUrl }}" class="action-button" target="_blank">
                            {{ $actionText }}
                        </a>
                    </div>
                @endisset

                {{-- Outro Lines --}}
                @foreach ($outroLines as $line)
                    <p class="outro">{{ $line }}</p>
                @endforeach

                @if (! empty($salutation))
                    <p class="salutation">{!! $salutation !!}</p>
                @else
                    <p class="salutation">Regards,<br>{{ $schoolName }}</p>
                @endif
            </div>

            <!-- Divider -->
            <hr class="divider">

            <!-- Footer -->
            <div class="email-footer">
                <p>&copy; {{ date('Y') }} {{ $schoolName }}. All rights reserved.</p>
                @if ($school && $school->postal_address)
                    <p>{{ $school->postal_address }}</p>
                @endif
                @if ($school && $school->phone_primary)
                    <p>Phone: {{ $school->phone_primary }}</p>
                @endif
                @if ($school && $school->email_primary)
                    <p>Email: <a href="mailto:{{ $school->email_primary }}">{{ $school->email_primary }}</a></p>
                @endif
                <p style="margin-top: 8px;">This is an automated message. Please do not reply directly to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>