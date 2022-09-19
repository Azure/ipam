# test_capitalize.py

def capitalize_string(s):
    return s.capitalize()

def capitalize_string(s):
    if not isinstance(s, str):
        raise TypeError('Please provide a string')
    return s.capitalize()

def test_capitalize_string():
    assert capitalize_string('test') == 'Test'    