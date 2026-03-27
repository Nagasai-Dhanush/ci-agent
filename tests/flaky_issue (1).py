from app import unstable_function

def test_flaky():
    result = unstable_function()
    assert result == "Success"